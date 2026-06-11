import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import {
  LlmAdapter,
  StreamChatParams,
  AgentChatParams,
  ContentBlock,
} from './adapter.interface';

/**
 * Provider suffix paths commonly used for Anthropic-protocol endpoints.
 * When baseURL ends with one of these, try the suffixed URL first,
 * then try the root URL (after stripping the suffix) as a fallback.
 * Longer suffixes are listed first so they match before shorter ones.
 * See cc-switch model_fetch.rs.
 */
const KNOWN_COMPAT_SUFFIXES = [
  '/api/claudecode',
  '/api/anthropic',
  '/apps/anthropic',
  '/api/coding',
  '/claudecode',
  '/anthropic',
  '/step_plan',
  '/coding',
  '/claude',
];

const FETCH_TIMEOUT_MS = 15_000;

@Injectable()
export class AnthropicAdapter implements LlmAdapter {
  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  async listModels(apiBaseUrl: string, apiKey: string): Promise<string[]> {
    const base = this.normalizeBaseUrl(apiBaseUrl);
    const candidates = this.buildModelUrlCandidates(base);

    for (const url of candidates) {
      Logger.debug(`[Anthropic] listModels: GET ${url}`);
      const result = await this.tryFetchModelsUrl(url, apiKey);
      if (result) return result;
    }

    return [];
  }

  /**
   * Build model-list endpoint candidates following cc-switch algorithm:
   *
   * 1. If baseURL ends with /v{N} (e.g. /v1, /v4), try {base}/models first,
   *    then {base}/v1/models (unless already /v1).
   * 2. Otherwise try {base}/v1/models.
   * 3. If baseURL ends with a known compat suffix (e.g. /anthropic, /api/coding),
   *    also try stripping it and use the root {stripped}/v1/models + {stripped}/models.
   * 4. De-duplicate preserving order.
   */
  private buildModelUrlCandidates(base: string): string[] {
    const candidates: string[] = [];

    if (this.endsWithVersionSegment(base)) {
      candidates.push(`${base}/models`);
      if (!base.endsWith('/v1')) {
        candidates.push(`${base}/v1/models`);
      }
    } else {
      candidates.push(`${base}/v1/models`);
    }

    // If base ends with a known compat suffix, also try the root URL
    const stripped = this.stripCompatSuffix(base);
    if (stripped) {
      const root = stripped.replace(/\/+$/, '');
      if (root.length > 0 && root.includes('://')) {
        candidates.push(`${root}/v1/models`);
        candidates.push(`${root}/models`);
      }
    }

    // deduplicate while preserving order
    return [...new Set(candidates)];
  }

  /** Check if URL ends with a version segment like /v1, /v4, /v10 */
  private endsWithVersionSegment(url: string): boolean {
    const last = url.split('/').pop() || '';
    if (!last.startsWith('v')) return false;
    const digits = last.slice(1);
    return digits.length > 0 && /^\d+$/.test(digits);
  }

  /**
   * If baseURL ends with a known compat suffix, return the URL with that suffix removed.
   * Longer suffixes match first (e.g. /api/anthropic before /anthropic).
   */
  private stripCompatSuffix(url: string): string | null {
    for (const suffix of KNOWN_COMPAT_SUFFIXES) {
      if (url.endsWith(suffix)) {
        return url.slice(0, url.length - suffix.length);
      }
    }
    return null;
  }

  private async tryFetchModelsUrl(
    url: string,
    apiKey: string,
  ): Promise<string[] | null> {
    // /v1/models is an OpenAI-compatible endpoint — all providers (including
    // Anthropic-protocol proxies) use Bearer auth for it, not x-api-key.
    // If Bearer gets 401/403, retry with x-api-key for providers that deviate.
    const authHeaders = [
      {
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      // { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    ];

    for (const headers of authHeaders) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        const response = await fetch(url, { headers, signal: ctrl.signal });
        clearTimeout(timer);
        Logger.debug(
          `[Anthropic] listModels: ${url} -> ${response.status} (${Object.keys(headers)[0]})`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.data?.length) {
            return data.data.map((m: any) => m.id as string);
          }
          return []; // empty list is valid — stop trying
        }
        // Only retry with next auth on 401/403; other errors (404) skip to next candidate
        if (response.status !== 401 && response.status !== 403) break;
      } catch (err) {
        Logger.error(`[Anthropic] Error fetching models from ${url}:`, err);
        break; // network error, don't retry with different auth
      }
    }
    return null;
  }

  streamChat(params: StreamChatParams): Observable<string> {
    const subject = new Subject<string>();
    void this.doStreamChat(params, subject);
    return subject.asObservable();
  }

  async chat(params: StreamChatParams): Promise<string> {
    const body = this.buildRequestBody(params, false);

    const base = this.normalizeBaseUrl(params.apiBaseUrl);
    const url = `${base}/v1/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    // Filter out thinking content blocks — only return text
    const textBlocks = (data.content || []).filter(
      (c: any) => c.type === 'text',
    );
    const content = textBlocks.map((c: any) => c.text).join('');
    if (!content) {
      Logger.warn('Anthropic chat response missing text content', data);
      return '';
    }
    return content;
  }

  /**
   * Build the request body shared by chat and streamChat.
   * Adds Anthropic extended thinking when thinkingBudgetTokens is set.
   */
  private buildRequestBody(params: StreamChatParams, stream: boolean): any {
    const body: any = {
      model: params.modelId,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      stream,
      messages: [{ role: 'user', content: params.userPrompt }],
    };
    if (params.systemPrompt) {
      body.system = params.systemPrompt;
    }

    // Anthropic extended thinking (Claude 3.7+)
    if (params.thinkingBudgetTokens && params.thinkingBudgetTokens >= 1024) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: Math.min(params.thinkingBudgetTokens, params.maxTokens),
      };
      // thinking budget must be less than max_tokens, so bump max_tokens if needed
      if (body.thinking.budget_tokens >= params.maxTokens) {
        body.max_tokens = body.thinking.budget_tokens + 1024;
      }
    }

    return body;
  }

  private async doStreamChat(
    params: StreamChatParams,
    subject: Subject<string>,
  ) {
    try {
      const body = this.buildRequestBody(params, true);

      const base = this.normalizeBaseUrl(params.apiBaseUrl);
      const url = `${base}/v1/messages`;
      Logger.debug(
        `Anthropic streamChat POST ${url}, model=${params.modelId}${body.thinking ? ', thinking=enabled' : ''}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': params.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        Logger.error(`Anthropic API error ${response.status}: ${errText}`);
        throw new Error(`API error: ${response.status} ${errText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const dataPrefix = trimmed.startsWith('data: ')
            ? 'data: '
            : trimmed.startsWith('data:')
              ? 'data:'
              : '';
          if (!dataPrefix) continue;
          const data = trimmed.slice(dataPrefix.length).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = this.extractDelta(parsed);
            if (delta) {
              totalTokens += delta.content.length;
              subject.next(JSON.stringify(delta));
            }
            if (
              parsed.type === 'message_stop' ||
              parsed.type === 'message_end'
            ) {
              Logger.debug(
                `Anthropic stream completed, totalChars=${totalTokens}`,
              );
              subject.complete();
              return;
            }
          } catch {
            /* skip malformed lines */
          }
        }
      }
      Logger.debug(
        `Anthropic stream finished (reader done), totalChars=${totalTokens}`,
      );
      subject.complete();
    } catch (error) {
      Logger.error('Anthropic streamChat error:', error);
      subject.error(error);
    }
  }

  /**
   * Extract content delta from a parsed SSE event.
   * Returns { kind: "thinking" | "text", content: string } or null.
   */
  private extractDelta(
    parsed: any,
  ): { kind: 'text' | 'thinking'; content: string } | null {
    if (!parsed || typeof parsed !== 'object') return null;

    // Anthropic extended thinking: content_block_delta with thinking_delta
    if (parsed.type === 'content_block_delta') {
      if (parsed.delta?.thinking) {
        return { kind: 'thinking', content: parsed.delta.thinking };
      }
      if (parsed.delta?.text != null) {
        return { kind: 'text', content: parsed.delta.text };
      }
    }

    // Anthropic content_block_start (signature_delta for thinking)
    if (parsed.type === 'content_block_start') {
      if (parsed.content_block?.text != null) {
        return { kind: 'text', content: parsed.content_block.text };
      }
    }

    // DeepSeek R1 reasoning_content (OpenAI protocol with reasoning)
    if (parsed.choices?.[0]?.delta?.reasoning_content != null) {
      return {
        kind: 'thinking',
        content: parsed.choices[0].delta.reasoning_content,
      };
    }

    // Standard OpenAI delta.content
    if (parsed.choices?.[0]?.delta?.content != null) {
      return { kind: 'text', content: parsed.choices[0].delta.content };
    }

    // Generic fallbacks
    if (parsed.delta?.content != null)
      return { kind: 'text', content: parsed.delta.content };
    if (parsed.delta?.type === 'text_delta' && parsed.delta?.text != null)
      return { kind: 'text', content: parsed.delta.text };
    if (parsed.text != null) return { kind: 'text', content: parsed.text };
    if (Array.isArray(parsed.content)) {
      return {
        kind: 'text',
        content: parsed.content.map((c: any) => c.text ?? '').join(''),
      };
    }

    return null;
  }

  private extractDeltaText(parsed: any): string | null {
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.type === 'content_block_delta' && parsed.delta?.text != null)
      return parsed.delta.text;
    if (
      parsed.type === 'content_block_start' &&
      parsed.content_block?.text != null
    )
      return parsed.content_block.text;
    if (parsed.delta?.content != null) return parsed.delta.content;
    if (parsed.delta?.type === 'text_delta' && parsed.delta?.text != null)
      return parsed.delta.text;
    if (parsed.text != null) return parsed.text;
    if (parsed.choices?.[0]?.delta?.content != null)
      return parsed.choices[0].delta.content;
    if (Array.isArray(parsed.content))
      return parsed.content.map((c: any) => c.text ?? '').join('');
    return null;
  }

  // ---- Agentic methods ----

  async agentTurn(params: AgentChatParams): Promise<ContentBlock[]> {
    const body = this.buildAgentBody(params, false);
    const base = this.normalizeBaseUrl(params.apiBaseUrl);
    const url = `${base}/v1/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return this.parseAnthropicContent(data.content || []);
  }

  streamAgentTurn(params: AgentChatParams): Observable<string> {
    const subject = new Subject<string>();
    void this.doStreamAgentTurn(params, subject);
    return subject.asObservable();
  }

  /**
   * Build request body for agentic turns.
   * Maps ConversationMessage[] to Anthropic messages format with tools.
   */
  private buildAgentBody(params: AgentChatParams, stream: boolean): any {
    const hasTools = params.tools != null && params.tools.length > 0;
    const body: any = {
      model: params.modelId,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      stream,
      messages: this.mapMessagesToAnthropic(hasTools, params),
    };

    if (params.systemPrompt) {
      body.system = params.systemPrompt;
    }

    // Map tool definitions to Anthropic tools format
    if (hasTools && params.tools) {
      body.tools = params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    // Extended thinking — enabled for both simple and agentic turns.
    // In agentic mode, mapMessagesToAnthropic inserts thinking
    // placeholders (type: "thinking", thinking: "") to satisfy
    // providers that require thinking blocks alongside tool_use
    // messages (Anthropic, Kimi, DeepSeek in Anthropic mode).
    const thin =
      params.thinkingBudgetTokens != null &&
      params.thinkingBudgetTokens >= 1024;
    if (thin) {
      // Opus 4.7+ uses adaptive thinking with output_config.effort
      // Older models (Sonnet 4, Opus 4.6) use thinking.type=enabled
      const isOpus47 = params.modelId.includes('opus-4-7');
      if (isOpus47) {
        body.thinking = { type: 'adaptive' };
        body.output_config = { effort: 'high' };
      } else {
        body.thinking = {
          type: 'enabled',
          budget_tokens: Math.min(params.thinkingBudgetTokens!, params.maxTokens),
        };
        if (body.thinking.budget_tokens >= params.maxTokens) {
          body.max_tokens = body.thinking.budget_tokens + 1024;
        }
      }
    }

    return body;
  }

  private mapMessagesToAnthropic(
    hasTools: boolean,
    params: AgentChatParams,
  ): any[] {
    return params.messages.map((msg) => {
      const content: any[] = [];
      let hasToolUse = false;
      for (const block of msg.content) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          hasToolUse = true;
          content.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          });
        } else if (block.type === 'tool_result') {
          content.push({
            type: 'tool_result',
            tool_use_id: block.tool_use_id,
            content: block.content,
            is_error: block.is_error,
          });
        }
      }
      // When extended thinking is enabled AND agentic tools are in use,
      // assistant messages with tool_use must include a thinking placeholder.
      //
      // We use type: "thinking" with an empty thinking string as this is the
      // standard Anthropic format that all providers (Anthropic, Kimi, DeepSeek
      // in Anthropic mode) accept. The older "redacted_thinking" type only works
      // with Anthropic's own API and causes errors on DeepSeek.
      //
      // For simple chat turns (hasTools=false), multi-turn tool_use doesn't
      // occur so no placeholder is needed.
      const thin =
        hasTools &&
        params.thinkingBudgetTokens != null &&
        params.thinkingBudgetTokens >= 1024;
      if (msg.role === 'assistant' && hasToolUse && thin) {
        const hasText = content.some((c) => c.type === 'text');
        if (!hasText) {
          content.unshift({ type: 'text', text: '' });
        }
        if (thin) {
          content.unshift({
            type: 'thinking',
            thinking: '',
          });
        }
      } else if (msg.role === 'assistant' && hasToolUse) {
        // Non-thinking mode: just ensure a text block exists
        const hasText = content.some((c) => c.type === 'text');
        if (!hasText) {
          content.unshift({ type: 'text', text: '' });
        }
      }
      return { role: msg.role, content };
    });
  }

  private parseAnthropicContent(rawContent: any[]): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    for (const c of rawContent) {
      if (c.type === 'text') {
        blocks.push({ type: 'text', text: c.text });
      } else if (c.type === 'thinking') {
        blocks.push({ type: 'thinking', thinking: c.thinking || '' });
      } else if (c.type === 'tool_use') {
        blocks.push({
          type: 'tool_use',
          id: c.id,
          name: c.name,
          input: c.input || {},
        });
      }
    }
    return blocks;
  }

  private async doStreamAgentTurn(
    params: AgentChatParams,
    subject: Subject<string>,
  ) {
    try {
      const body = this.buildAgentBody(params, true);
      const base = this.normalizeBaseUrl(params.apiBaseUrl);
      const url = `${base}/v1/messages`;

      subject.next(JSON.stringify({ kind: 'message_start' }));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': params.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error: ${response.status} ${errText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Track tool_use accumulation across content blocks
      let currentToolUse: {
        id?: string;
        name?: string;
        inputJson: string;
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const dataPrefix = trimmed.startsWith('data: ')
            ? 'data: '
            : trimmed.startsWith('data:')
              ? 'data:'
              : '';
          if (!dataPrefix) continue;
          const data = trimmed.slice(dataPrefix.length).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            // Handle content_block_start for tool_use
            if (parsed.type === 'content_block_start') {
              if (parsed.content_block?.type === 'tool_use') {
                currentToolUse = {
                  id: parsed.content_block.id,
                  name: parsed.content_block.name,
                  inputJson: '',
                };
              }
              // Also handle text content_block_start
              if (
                parsed.content_block?.text != null &&
                parsed.content_block.type === 'text'
              ) {
                subject.next(
                  JSON.stringify({
                    kind: 'text',
                    content: parsed.content_block.text,
                  }),
                );
              }
            }

            // Handle content_block_delta
            if (parsed.type === 'content_block_delta') {
              // Thinking delta
              if (parsed.delta?.thinking) {
                subject.next(
                  JSON.stringify({
                    kind: 'thinking',
                    content: parsed.delta.thinking,
                  }),
                );
              }
              // Text delta
              if (parsed.delta?.text != null) {
                subject.next(
                  JSON.stringify({ kind: 'text', content: parsed.delta.text }),
                );
              }
              // Tool input JSON delta
              if (parsed.delta?.partial_json && currentToolUse) {
                currentToolUse.inputJson += parsed.delta.partial_json;
              }
            }

            // Handle content_block_stop — emit completed tool_use
            if (parsed.type === 'content_block_stop') {
              if (currentToolUse && currentToolUse.id && currentToolUse.name) {
                let input: object = {};
                try {
                  input = JSON.parse(currentToolUse.inputJson);
                } catch {
                  /* partial */
                }
                subject.next(
                  JSON.stringify({
                    kind: 'tool_use',
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input,
                  }),
                );
              }
              currentToolUse = null;
            }

            if (
              parsed.type === 'message_stop' ||
              parsed.type === 'message_end'
            ) {
              subject.next(JSON.stringify({ kind: 'message_stop' }));
              subject.complete();
              return;
            }
          } catch {
            /* skip */
          }
        }
      }
      subject.next(JSON.stringify({ kind: 'message_stop' }));
      subject.complete();
    } catch (error) {
      Logger.error('Anthropic streamAgentTurn error:', error);
      subject.error(error);
    }
  }
}
