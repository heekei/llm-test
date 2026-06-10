import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { AdapterFactory } from '../llm/factories/adapter.factory';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { RunTargetDto } from './dto/run-task.dto';
import { AgentService } from '../agent/agent.service';

interface SseEvent {
  data: string;
}

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private adapterFactory: AdapterFactory,
    private agentService: AgentService,
  ) {}

  async findAll() {
    const tasks = await this.prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    return tasks.map(t => this.parseDefaultTargets(t));
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          include: { provider: { select: { id: true, name: true } } },
        },
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.parseDefaultTargets(task);
  }

  create(dto: CreateTaskDto) {
    const data: any = { ...dto };
    if (dto.defaultTargets && dto.defaultTargets.length > 0) {
      data.defaultTargets = JSON.stringify(dto.defaultTargets);
    } else {
      delete data.defaultTargets;
    }
    // JSON-stringify tools array if present
    if (data.tools !== undefined) {
      data.tools = data.tools ? JSON.stringify(data.tools) : null;
    }
    return this.prisma.task.create({ data });
  }

  private parseDefaultTargets(task: any): any {
    if (task.defaultTargets && typeof task.defaultTargets === 'string') {
      try {
        task = { ...task, defaultTargets: JSON.parse(task.defaultTargets) };
      } catch {
        task = { ...task, defaultTargets: null };
      }
    }
    if (task.runs) {
      task = {
        ...task,
        runs: task.runs.map((run: any) => this.parseRunAiScores(run)),
      };
    }
    return task;
  }

  private parseRunAiScores(run: any): any {
    let result = { ...run };
    if (run.aiScores && typeof run.aiScores === 'string') {
      try {
        result = { ...result, aiScores: JSON.parse(run.aiScores) };
      } catch {
        result = { ...result, aiScores: null };
      }
    }
    if (run.agentTrace && typeof run.agentTrace === 'string') {
      try {
        result = { ...result, agentTrace: JSON.parse(run.agentTrace) };
      } catch {
        result = { ...result, agentTrace: null };
      }
    }
    if (run.agentStats && typeof run.agentStats === 'string') {
      try {
        result = { ...result, agentStats: JSON.parse(run.agentStats) };
      } catch {
        result = { ...result, agentStats: null };
      }
    }
    return result;
  }

  async update(id: string, dto: UpdateTaskDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    // JSON-stringify tools array if present (SQLite text field)
    if (dto.tools !== undefined) {
      data.tools = dto.tools ? JSON.stringify(dto.tools) : null;
    }
    return this.prisma.task.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });
  }

  runTaskStream(taskId: string, targets: RunTargetDto[]): Observable<SseEvent> {
    const out = new Subject<SseEvent>();

    (async () => {
      try {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
          out.next({ data: JSON.stringify({ type: 'error', error: `Task ${taskId} not found` }) });
          out.complete();
          return;
        }

        // Create TaskRun rows for each target
        const runs = await Promise.all(
          targets.map((t) =>
            this.prisma.taskRun.create({
              data: {
                taskId,
                providerId: t.providerId,
                modelId: t.modelId,
                status: 'running',
                startedAt: new Date(),
              },
            }),
          ),
        );

        // Emit created events
        for (let i = 0; i < runs.length; i++) {
          out.next({
            data: JSON.stringify({
              type: 'created',
              runId: runs[i].id,
              providerId: targets[i].providerId,
              modelId: targets[i].modelId,
            }),
          });
        }

        // Run each target in parallel
        let pending = runs.length;
        runs.forEach((run, i) => {
          this.executeRun(task, run, targets[i], out).finally(() => {
            pending--;
            if (pending === 0) {
              out.next({ data: JSON.stringify({ type: 'done' }) });
              out.complete();
            }
          });
        });
      } catch (err: any) {
        out.next({ data: JSON.stringify({ type: 'error', error: err.message }) });
        out.complete();
      }
    })();

    return out.asObservable();
  }

  private async executeRun(
    task: any,
    run: any,
    target: RunTargetDto,
    out: Subject<SseEvent>,
  ) {
    // Route to AgentService for agentic mode
    if (task.mode === 'agentic') {
      const provider = await this.prisma.provider.findUnique({ where: { id: target.providerId } });
      if (!provider) throw new Error(`Provider ${target.providerId} not found`);
      const apiKey = this.encryption.decrypt(provider.apiKey);
      return this.agentService.runAgent(task, run, target, provider, apiKey, out);
    }

    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let accumulated = '';
    let accumulatedThinking = '';

    try {
      const provider = await this.prisma.provider.findUnique({ where: { id: target.providerId } });
      if (!provider) throw new Error(`Provider ${target.providerId} not found`);

      const adapter = this.adapterFactory.get(provider.adapterType);
      const apiKey = this.encryption.decrypt(provider.apiKey);

      await new Promise<void>((resolve, reject) => {
        const sub = adapter
          .streamChat({
            apiBaseUrl: provider.apiBaseUrl,
            apiKey,
            modelId: target.modelId,
            systemPrompt: task.systemPrompt ?? undefined,
            userPrompt: task.prompt,
            temperature: task.temperature,
            maxTokens: task.maxTokens,
            thinkingBudgetTokens: task.thinkingBudgetTokens ?? undefined,
            reasoningEffort: task.reasoningEffort ?? undefined,
          })
          .subscribe({
            next: (raw) => {
              if (firstTokenTime === null) firstTokenTime = Date.now();
              // Parse JSON envelope { kind: "text"|"thinking", content: string }
              try {
                const delta = JSON.parse(raw);
                if (delta.kind === 'thinking') {
                  accumulatedThinking += delta.content;
                  out.next({
                    data: JSON.stringify({ type: 'thinking', runId: run.id, content: delta.content }),
                  });
                } else {
                  accumulated += delta.content;
                  out.next({
                    data: JSON.stringify({ type: 'delta', runId: run.id, content: delta.content }),
                  });
                }
              } catch {
                // Legacy plain-text fallback (shouldn't happen, but be safe)
                accumulated += raw;
                out.next({
                  data: JSON.stringify({ type: 'delta', runId: run.id, content: raw }),
                });
              }
            },
            error: (err) => reject(err),
            complete: () => resolve(),
          });
      });

      const completedAt = new Date();
      const totalMs = Date.now() - startTime;
      const latencyMs = firstTokenTime !== null ? firstTokenTime - startTime : null;

      await this.prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          output: accumulated,
          thinkingOutput: accumulatedThinking || null,
          completedAt,
          firstTokenAt: firstTokenTime ? new Date(firstTokenTime) : null,
          latencyMs,
        },
      });

      out.next({
        data: JSON.stringify({
          type: 'complete',
          runId: run.id,
          output: accumulated,
          thinkingOutput: accumulatedThinking || null,
          latencyMs,
          totalMs,
        }),
      });
    } catch (err: any) {
      await this.prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status: 'error',
          error: err.message,
          output: accumulated || null,
          thinkingOutput: accumulatedThinking || null,
          completedAt: new Date(),
        },
      });
      out.next({
        data: JSON.stringify({ type: 'error', runId: run.id, error: err.message }),
      });
    }
  }
}
