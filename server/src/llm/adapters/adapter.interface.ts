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

// ---- Agentic evaluation types ----

/** JSON Schema for a tool's input parameters */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

/** A block of text content from the assistant */
export interface ContentBlockText {
  type: 'text';
  text: string;
}

/** An assistant tool_use block — the model wants to call a tool */
export interface ContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: object;
}

/** A user tool_result block — the result of executing a tool call */
export interface ContentBlockToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock =
  | ContentBlockText
  | ContentBlockToolUse
  | ContentBlockToolResult;

/** A single message in an agentic conversation */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

/** Parameters for an agentic LLM turn */
export interface AgentChatParams {
  apiBaseUrl: string;
  apiKey: string;
  modelId: string;
  systemPrompt?: string;
  messages: ConversationMessage[];
  tools: ToolDefinition[];
  temperature: number;
  maxTokens: number;
  thinkingBudgetTokens?: number;
  reasoningEffort?: string;
}

export interface LlmAdapter {
  /** List available model IDs from the provider */
  listModels(apiBaseUrl: string, apiKey: string): Promise<string[]>;

  /**
   * Streaming one-shot chat completion.
   * Emits JSON envelopes: { kind: "text" | "thinking", content: string }
   */
  streamChat(params: StreamChatParams): Observable<string>;

  /**
   * Non-streaming one-shot chat completion. Returns the full response text.
   */
  chat(params: StreamChatParams): Promise<string>;

  /**
   * Non-streaming agentic turn. Sends the full conversation + tool definitions
   * and returns an array of content blocks (text and/or tool_use).
   */
  agentTurn(params: AgentChatParams): Promise<ContentBlock[]>;

  /**
   * Streaming agentic turn. Emits JSON envelopes:
   *   { kind: "message_start" }
   *   { kind: "text", content: string }
   *   { kind: "thinking", content: string }
   *   { kind: "tool_use", id: string, name: string, input: object }
   *   { kind: "message_stop" }
   */
  streamAgentTurn(params: AgentChatParams): Observable<string>;
}
