import { Observable } from 'rxjs';

export interface StreamChatParams {
  apiBaseUrl: string;
  apiKey: string;
  modelId: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  /** Anthropic: extended thinking budget in tokens (min 1024, must be < maxTokens) */
  thinkingBudgetTokens?: number;
  /** OpenAI o-series: reasoning effort level ("low" | "medium" | "high") */
  reasoningEffort?: string;
}

export interface LlmAdapter {
  listModels(apiBaseUrl: string, apiKey: string): Promise<string[]>;
  streamChat(params: StreamChatParams): Observable<string>;
  /**
   * Non-streaming chat completion. Returns the full response text.
   */
  chat(params: StreamChatParams): Promise<string>;
}
