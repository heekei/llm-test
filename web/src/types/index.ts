export interface Provider {
  id: string;
  name: string;
  apiBaseUrl: string;
  apiKey: string; // masked
  adapterType: 'openai' | 'anthropic';
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  id: string;
  providerId: string;
  modelId: string;
  name: string;
  provider?: {
    id: string;
    name: string;
    adapterType: string;
  };
}

export interface AgentTraceStep {
  iteration: number;
  kind: 'llm_text' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolCallId?: string;
  toolInput?: object;
  isError?: boolean;
  timestamp: string;
}

export interface AgentStats {
  iterations: number;
  toolCalls: number;
  totalTimeMs?: number;
  toolExecTimeMs?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  systemPrompt?: string | null;
  prompt: string;
  temperature: number;
  maxTokens: number;
  thinkingBudgetTokens?: number | null;
  reasoningEffort?: string | null;
  mode?: 'simple' | 'agentic' | null;
  tools?: string[] | null;
  maxIterations?: number | null;
  agentTimeoutSec?: number | null;
  dockerImage?: string | null;
  defaultTargets?: RunTarget[] | null;
  createdAt: string;
  updatedAt: string;
  _count?: { runs: number };
  runs?: TaskRun[];
}

export interface AiScoreItem {
  dimension: string;
  score: number;
  maxScore: number;
  weight: number;
  reasoning: string;
}

export interface AiScoreResult {
  scores: AiScoreItem[];
  overall: string;
  judgeProviderId: string;
  judgeModelId: string;
  judgedAt: string;
}

export interface TaskRun {
  id: string;
  taskId: string;
  providerId?: string | null;
  modelId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  output?: string | null;
  thinkingOutput?: string | null;
  error?: string | null;
  latencyMs?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  score?: number | null;
  scoreNote?: string | null;
  aiScores?: AiScoreResult[] | null;
  agentTrace?: AgentTraceStep[] | null;
  agentStats?: AgentStats | null;
  sandboxId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  task?: { id: string; title: string };
  provider?: { id: string; name: string; adapterType?: string };
}

export interface RunTarget {
  providerId: string;
  providerName: string;
  modelId: string;
}

export interface CreateProviderInput {
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  adapterType: 'openai' | 'anthropic';
}

export interface UpdateProviderInput {
  name?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  adapterType?: 'openai' | 'anthropic';
  isEnabled?: boolean;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  thinkingBudgetTokens?: number;
  reasoningEffort?: string;
  mode?: 'simple' | 'agentic';
  tools?: string[];
  maxIterations?: number;
  agentTimeoutSec?: number;
  dockerImage?: string;
  defaultTargets?: RunTarget[];
  attachmentFiles?: AttachmentFile[];
}

export interface AttachmentFile {
  filename: string;
  originalName: string;
  mimeType: string;
}

export interface UploadAttachmentResponse {
  filename: string;
  originalName: string;
  mimeType: string;
  path: string;
  size: number;
}
