import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { AdapterFactory } from '../llm/factories/adapter.factory';
import { ScoreRunDto } from './dto/score-run.dto';
import { AiScoreRequestDto } from './dto/ai-score.dto';

interface AiScoreResult {
  scores: {
    dimension: string;
    score: number;
    maxScore: number;
    weight: number;
    reasoning: string;
  }[];
  overall: string;
  judgeProviderId: string;
  judgeModelId: string;
  judgedAt: string;
}

const SCORING_SYSTEM_PROMPT = `你是一个专业的AI模型输出评估专家。你的任务是对模型回答从多个维度进行客观评分。

请从以下维度评估模型回答（每项1-10分）：

1. 准确性 (accuracy)，权重25%：事实正确性、无幻觉、真实可靠
2. 完整性 (completeness)，权重20%：是否全面回应了提示词的所有方面，无遗漏
3. 逻辑性 (coherence)，权重20%：结构清晰、逻辑自洽、可读性高
4. 创造性 (creativity)，权重15%：有独特见解、新颖角度、表达生动
5. 指令遵循 (instructionFollowing)，权重20%：严格遵循格式要求、约束条件和显式指令

你必须只返回一个JSON对象，格式如下（不要markdown，不要JSON之外的任何解释）：
{
  "scores": [
    { "dimension": "accuracy", "score": 数字, "maxScore": 10, "reasoning": "简短评分理由（中文）" },
    { "dimension": "completeness", "score": 数字, "maxScore": 10, "reasoning": "简短评分理由（中文）" },
    { "dimension": "coherence", "score": 数字, "maxScore": 10, "reasoning": "简短评分理由（中文）" },
    { "dimension": "creativity", "score": 数字, "maxScore": 10, "reasoning": "简短评分理由（中文）" },
    { "dimension": "instructionFollowing", "score": 数字, "maxScore": 10, "reasoning": "简短评分理由（中文）" }
  ],
  "overall": "一句话总结本次评估（中文）"
}`;

function extractJson(text: string): Record<string, unknown> | null {
  // Try to extract JSON from markdown code blocks or raw JSON
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  // Try raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  return null;
}

function safeParseJson(str: string): any[] | null {
  try {
    const val = JSON.parse(str);
    return Array.isArray(val) ? val : [val];
  } catch {
    return null;
  }
}

function parseRunAiScores(run: any): any {
  let result = { ...run };
  if (run.aiScores && typeof run.aiScores === 'string') {
    const parsed = safeParseJson(run.aiScores);
    result = { ...result, aiScores: parsed };
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

@Injectable()
export class RunsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private adapterFactory: AdapterFactory,
  ) {}

  async findAll(params: {
    taskId?: string;
    providerId?: string;
    status?: string;
  }) {
    const where: any = {};
    if (params.taskId) where.taskId = params.taskId;
    if (params.providerId) where.providerId = params.providerId;
    if (params.status) where.status = params.status;
    const runs = await this.prisma.taskRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        task: { select: { id: true, title: true } },
        provider: { select: { id: true, name: true } },
      },
    });
    return runs.map(parseRunAiScores);
  }

  async findOne(id: string) {
    const run = await this.prisma.taskRun.findUnique({
      where: { id },
      include: {
        task: true,
        provider: { select: { id: true, name: true, adapterType: true } },
      },
    });
    if (!run) throw new NotFoundException(`Run ${id} not found`);
    return parseRunAiScores(run);
  }

  async score(id: string, dto: ScoreRunDto) {
    await this.findOne(id);
    return this.prisma.taskRun.update({
      where: { id },
      data: { score: dto.score, scoreNote: dto.scoreNote },
    });
  }

  async aiScore(id: string, dto: AiScoreRequestDto) {
    const run = await this.prisma.taskRun.findUnique({
      where: { id },
      include: { task: true },
    });
    if (!run) throw new NotFoundException(`运行 ${id} 未找到`);
    if (!run.output) {
      // Agentic runs may have agentTrace but no final text output — still scorable
      if (run.agentTrace) {
        run.output = '(Agentic run — see tool trace for full output)';
        return this.aiScore(id, dto); // retry with synthetic output
      }
      throw new Error('该运行没有输出内容可供评估');
    }

    const judgeProvider = await this.prisma.provider.findUnique({
      where: { id: dto.judgeProviderId },
    });
    if (!judgeProvider)
      throw new Error(`裁判模型供应商 ${dto.judgeProviderId} 未找到`);

    const adapter = this.adapterFactory.get(judgeProvider.adapterType);
    const apiKey = this.encryption.decrypt(judgeProvider.apiKey);

    const userPrompt =
      `## 原始任务提示词\n${run.task.prompt}\n\n` +
      (run.task.systemPrompt
        ? `## 系统提示词\n${run.task.systemPrompt}\n\n`
        : '') +
      (run.thinkingOutput ? `## 模型思考过程\n${run.thinkingOutput}\n\n` : '') +
      (run.agentTrace ? `## 模型工具调用痕迹\n${run.agentTrace}\n\n` : '') +
      `## 模型回答\n${run.output}\n\n` +
      `请评估以上模型回答。如有思考过程和工具调用痕迹，它们展示了模型的完整工作链条，也请纳入评估考量。请严格按照系统提示词中指定的JSON格式返回结果。`;

    const responseText = await adapter.chat({
      apiBaseUrl: judgeProvider.apiBaseUrl,
      apiKey,
      modelId: dto.judgeModelId,
      systemPrompt: SCORING_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.2,
      maxTokens: 4096,
    });

    const parsed = extractJson(responseText);
    if (!parsed || !Array.isArray(parsed.scores)) {
      throw new Error(`无法解析AI评分响应: ${responseText.slice(0, 200)}`);
    }

    // Validate and normalize scores
    const dimensions = [
      'accuracy',
      'completeness',
      'coherence',
      'creativity',
      'instructionFollowing',
    ];
    const weights: Record<string, number> = {
      accuracy: 0.25,
      completeness: 0.2,
      coherence: 0.2,
      creativity: 0.15,
      instructionFollowing: 0.2,
    };

    const scores = dimensions.map((dim) => {
      const scoresArr = (parsed.scores as Array<Record<string, unknown>>) || [];
      const s = scoresArr.find((x: any) => x.dimension === dim);
      return {
        dimension: dim,
        score: Math.max(1, Math.min(10, Math.round(Number(s?.score) || 5))),
        maxScore: 10,
        weight: weights[dim],
        reasoning: String((s as any)?.reasoning || '未提供评分理由'),
      };
    });

    const newEntry: AiScoreResult = {
      scores,
      overall: typeof parsed.overall === 'string' ? parsed.overall : '',
      judgeProviderId: dto.judgeProviderId,
      judgeModelId: dto.judgeModelId,
      judgedAt: new Date().toISOString(),
    };

    // Append to existing array (support multiple judges per run)
    const existing: AiScoreResult[] = run.aiScores
      ? safeParseJson(run.aiScores) || []
      : [];
    existing.push(newEntry);

    const updated = await this.prisma.taskRun.update({
      where: { id },
      data: { aiScores: JSON.stringify(existing) },
    });

    return { ...updated, aiScores: existing };
  }

  async deleteAiScore(id: string, judgeIndex: number) {
    const run = await this.prisma.taskRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`运行 ${id} 未找到`);

    const existing: AiScoreResult[] = run.aiScores
      ? safeParseJson(run.aiScores) || []
      : [];
    if (judgeIndex < 0 || judgeIndex >= existing.length) {
      throw new Error('评分索引无效');
    }
    existing.splice(judgeIndex, 1);

    return this.prisma.taskRun.update({
      where: { id },
      data: { aiScores: existing.length > 0 ? JSON.stringify(existing) : null },
    });
  }

  async compareByTask(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`任务 ${taskId} 未找到`);

    const runs = await this.prisma.taskRun.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        provider: { select: { id: true, name: true, adapterType: true } },
      },
    });

    return {
      task: { id: task.id, title: task.title, prompt: task.prompt },
      runs: runs.map(parseRunAiScores),
    };
  }

  // Fire-and-forget background scoring
  async aiScoreBackground(id: string, dto: AiScoreRequestDto) {
    try {
      return await this.aiScore(id, dto);
    } catch (err) {
      console.error(`AI评分后台任务出错 run ${id}:`, err);
    }
  }
}
