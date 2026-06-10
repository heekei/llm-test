import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdapterFactory } from '../llm/factories/adapter.factory';
import { DockerService } from './docker.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import {
  ContentBlockToolUse,
  ContentBlockToolResult,
  ConversationMessage,
} from '../llm/adapters/adapter.interface';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

/** Strip ANSI escape codes and control characters from tool output */
function sanitizeOutput(raw: string): string {
  // Use String.fromCharCode to avoid no-control-regex ESLint rule
  const ESC = String.fromCharCode(0x1b);
  const ansiPattern = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
  // Match control chars \x00-\x08, \x0b, \x0c, \x0e-\x1f (keep \n=\x0a, \t=\x09)
  const ranges: string[] = [];
  // \x00-\x08
  ranges.push(`${String.fromCharCode(0x00)}-${String.fromCharCode(0x08)}`);
  // \x0b (alone)
  ranges.push(String.fromCharCode(0x0b));
  // \x0c (alone)
  ranges.push(String.fromCharCode(0x0c));
  // \x0e-\x1f
  ranges.push(`${String.fromCharCode(0x0e)}-${String.fromCharCode(0x1f)}`);
  const controlCharPattern = new RegExp(`[${ranges.join('')}]`, 'g');
  return raw.replace(ansiPattern, '').replace(controlCharPattern, '').trim();
}

interface AgentTraceStep {
  iteration: number;
  kind: 'llm_text' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolCallId?: string;
  toolInput?: object;
  isError?: boolean;
  timestamp: string;
}

interface SseEvent {
  data: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly adapterFactory: AdapterFactory,
    private readonly dockerService: DockerService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  async runAgent(
    task: any,
    run: any,
    target: { providerId: string; modelId: string },
    provider: any,
    apiKey: string,
    out: Subject<SseEvent>,
  ): Promise<void> {
    const startTime = Date.now();
    const maxIterations = task.maxIterations || 20;
    const timeoutSec = task.agentTimeoutSec || 300;
    const trace: AgentTraceStep[] = [];
    let accumulatedText = '';
    let containerId: string | null = null;
    let workspaceDir = '';

    try {
      // Parse enabled tools
      const toolIds: string[] = task.tools
        ? this.safeParseJson(task.tools) || []
        : [];
      const toolDefs = this.toolRegistry.getDefinitions(
        toolIds.length > 0 ? toolIds : null,
      );

      // Create workspace directory on host
      workspaceDir = path.join(os.tmpdir(), `agent-workspace-${run.id}`);
      await fs.mkdir(workspaceDir, { recursive: true });

      // Create Docker sandbox (if Docker is available)
      if (this.dockerService.isAvailable()) {
        containerId = await this.dockerService.createContainer(
          task.dockerImage || undefined,
          workspaceDir,
          timeoutSec,
        );
        Logger.log(
          `Agent sandbox created: ${containerId.slice(0, 12)} for run ${run.id}`,
        );
      }

      // Initialize conversation
      const messages: ConversationMessage[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: task.prompt }],
        },
      ];

      // --- ReAct loop ---
      let stopped = false;
      for (let iter = 0; iter < maxIterations && !stopped; iter++) {
        // Emit iteration event
        out.next({
          data: JSON.stringify({
            type: 'agent_iteration',
            runId: run.id,
            iteration: iter + 1,
          }),
        });

        // Call LLM
        const adapter = this.adapterFactory.get(provider.adapterType);
        const blocks = await adapter.agentTurn({
          apiBaseUrl: provider.apiBaseUrl,
          apiKey,
          modelId: target.modelId,
          systemPrompt: task.systemPrompt ?? undefined,
          messages,
          tools: toolDefs,
          temperature: task.temperature,
          maxTokens: task.maxTokens,
          thinkingBudgetTokens: task.thinkingBudgetTokens ?? undefined,
          reasoningEffort: task.reasoningEffort ?? undefined,
        });

        // Append assistant response to conversation
        messages.push({ role: 'assistant', content: blocks });

        // Emit text blocks as SSE deltas
        for (const block of blocks) {
          if (block.type === 'text') {
            accumulatedText += block.text;
            out.next({
              data: JSON.stringify({
                type: 'delta',
                runId: run.id,
                content: block.text,
              }),
            });
            trace.push({
              iteration: iter + 1,
              kind: 'llm_text',
              content: block.text,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Extract tool_use blocks
        const toolUses = blocks.filter(
          (b): b is ContentBlockToolUse => b.type === 'tool_use',
        );
        if (toolUses.length === 0) {
          // No more tool calls — agent is done
          stopped = true;
          break;
        }

        // Execute tools sequentially
        const toolResults: ContentBlockToolResult[] = [];
        for (const tu of toolUses) {
          // Emit tool_call SSE
          out.next({
            data: JSON.stringify({
              type: 'tool_call',
              runId: run.id,
              toolCallId: tu.id,
              toolName: tu.name,
              input: tu.input,
            }),
          });

          const t0 = Date.now();
          let result: { stdout: string; stderr: string; exitCode: number };
          let isError = false;

          try {
            const handler = this.toolRegistry.getHandler(tu.name);
            const cmd = handler.toCommand(
              tu.input as Record<string, unknown>,
              '/workspace',
            );

            if (containerId) {
              result = await this.dockerService.execInContainer(
                containerId,
                cmd,
                '/workspace',
              );
            } else {
              // Docker not available — run locally via bash (for development only)
              result = await this.execLocal(cmd, workspaceDir);
            }

            isError = result.exitCode !== 0;
          } catch (err: any) {
            result = { stdout: '', stderr: err.message, exitCode: -1 };
            isError = true;
          }

          // Combine stdout + stderr for the complete tool result, sanitize control chars
          const combined = [result.stdout, result.stderr]
            .filter(Boolean)
            .join('\n');
          const output = sanitizeOutput(
            isError ? combined || 'Unknown error' : combined || '(no output)',
          );
          const latencyMs = Date.now() - t0;

          // Emit tool_result SSE
          out.next({
            data: JSON.stringify({
              type: 'tool_result',
              runId: run.id,
              toolCallId: tu.id,
              result: output,
              isError,
              latencyMs,
            }),
          });

          // Add to trace
          trace.push({
            iteration: iter + 1,
            kind: 'tool_call',
            content: output,
            toolName: tu.name,
            toolCallId: tu.id,
            toolInput: tu.input,
            isError,
            timestamp: new Date().toISOString(),
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: output,
            is_error: isError,
          });
        }

        // Add tool results as user message for next turn
        messages.push({ role: 'user', content: toolResults });
      }

      // --- Persist ---
      const completedAt = new Date();
      const totalMs = Date.now() - startTime;

      const stats = {
        iterations: trace.length > 0 ? trace[trace.length - 1].iteration : 0,
        toolCalls: trace.filter((t: AgentTraceStep) => t.kind === 'tool_call')
          .length,
      };

      await this.prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          output: accumulatedText,
          agentTrace: JSON.stringify(trace),
          agentStats: JSON.stringify(stats),
          sandboxId: containerId,
          completedAt,
          latencyMs: totalMs,
        },
      });

      out.next({
        data: JSON.stringify({
          type: 'complete',
          runId: run.id,
          output: accumulatedText,
          latencyMs: totalMs,
          totalMs,
        }),
      });
    } catch (err: any) {
      Logger.error(`Agent run error for run ${run.id}:`, err);
      await this.prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status: 'error',
          error: err.message,
          output: accumulatedText || null,
          agentTrace: JSON.stringify(trace),
          sandboxId: containerId,
          completedAt: new Date(),
        },
      });
      out.next({
        data: JSON.stringify({
          type: 'error',
          runId: run.id,
          error: err.message,
        }),
      });
    } finally {
      // Clean up Docker container
      if (containerId) {
        await this.dockerService.destroyContainer(containerId).catch((err) => {
          Logger.warn(
            `Failed to destroy container ${containerId?.slice(0, 12)}: ${err}`,
          );
        });
      }
      // Clean up workspace directory (keep for now — could be useful for debugging)
    }
  }

  private safeParseJson(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Execute a command locally (fallback when Docker is not available).
   */
  private async execLocal(
    cmd: string,
    workspaceDir: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { exec } = await import('child_process');
    return new Promise((resolve) => {
      exec(
        cmd,
        { cwd: workspaceDir, timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
        (error: any, stdout: string, stderr: string) => {
          resolve({
            exitCode: error?.code || 0,
            stdout: stdout || '',
            stderr: stderr || '',
          });
        },
      );
    });
  }
}
