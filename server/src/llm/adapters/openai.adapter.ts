import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { LlmAdapter, StreamChatParams, AgentChatParams, ContentBlock, ConversationMessage } from './adapter.interface';

const FETCH_TIMEOUT_MS = 15_000;

@Injectable()
export class OpenAiAdapter implements LlmAdapter {
  /**
   * Build model-list endpoint candidates following cc-switch logic.
   * 1. If baseURL ends with /v{N} (e.g. /v1, /v4), try {base}/models first,
   *    then {base}/v1/models (unless base already ends with /v1).
   * 2. Otherwise try {base}/v1/models.
   * 3. Also try {base}/models as a final fallback.
   */
  async listModels(apiBaseUrl: string, apiKey: string): Promise<string[]> {
    const base = apiBaseUrl.replace(/\/+$/, '');
    const candidates = this.buildModelUrlCandidates(base);

    for (const url of candidates) {
      Logger.debug(`[OpenAI] listModels: GET ${url}`);
      const result = await this.tryFetch(url, apiKey);
      if (result) return result;
    }

    return [];
  }

  private buildModelUrlCandidates(base: string): string[] {
    const candidates: string[] = [];

    if (this.endsWithVersionSegment(base)) {
      // {base}/models first (correct for /v4 etc.), then /v1/models unless base is /v1
      candidates.push(`${base}/models`);
      if (!base.endsWith('/v1')) {
        candidates.push(`${base}/v1/models`);
      }
    } else {
      candidates.push(`${base}/v1/models`);
      candidates.push(`${base}/models`);
    }

    // deduplicate while preserving order
    return [...new Set(candidates)];
  }

  /** Check if baseURL ends with a version segment like /v1, /v4, /v10 */
  private endsWithVersionSegment(url: string): boolean {
    const last = url.split('/').pop() || '';
    if (!last.startsWith('v')) return false;
    const digits = last.slice(1);
    return digits.length > 0 && /^\d+$/.test(digits);
  }

  private async tryFetch(url: string, apiKey: string): Promise<string[] | null> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      Logger.debug(`[OpenAI] listModels: ${url} -> ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        if (data.data?.length) {
          return data.data.map((m: any) => m.id as string);
        }
      }
    } catch (err) {
      Logger.error(`[OpenAI] Error fetching models from ${url}:`, err);
    }
    return null;
  }

  streamChat(params: StreamChatParams): Observable<string> {
    const subject = new Subject<string>();
    this.doStreamChat(params, subject);
    return subject.asObservable();
  }

  /**
   * Build the request body shared by chat and streamChat.
   * Adds reasoning_effort for o-series models when reasoningEffort is set.
   * Skips temperature for reasoning models (they don't support it).
   */
  private buildChatBody(params: StreamChatParams, stream: boolean): any {
    const messages: any[] = [];
    if (params.systemPrompt) messages.push({ role: 'system', content: params.systemPrompt });
    messages.push({ role: 'user', content: params.userPrompt });

    const body: any = {
      model: params.modelId,
      messages,
      max_completion_tokens: params.maxTokens,
      stream,
    };

    // o-series reasoning models don't support temperature
    const isReasoningModel = params.modelId.startsWith('o') || params.reasoningEffort != null;
    if (!isReasoningModel) {
      body.temperature = params.temperature;
    }

    if (params.reasoningEffort) {
      body.reasoning_effort = params.reasoningEffort;
    }

    return body;
  }

  async chat(params: StreamChatParams): Promise<string> {
    const base = params.apiBaseUrl.replace(/\/+$/, '');
    const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

    const body = this.buildChatBody(params, false);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`API error: ${response.status} ${await response.text()}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') { Logger.warn('OpenAI chat response missing content', data); return ''; }
    return content;
  }

  private async doStreamChat(params: StreamChatParams, subject: Subject<string>) {
    try {
      const base = params.apiBaseUrl.replace(/\/+$/, '');
      const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

      const body = this.buildChatBody(params, true);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.apiKey}` },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`API error: ${response.status} ${await response.text()}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') { subject.complete(); return; }
          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;
            // DeepSeek R1 reasoning_content (thinking)
            if (choice.delta?.reasoning_content) {
              subject.next(JSON.stringify({ kind: 'thinking', content: choice.delta.reasoning_content }));
            }
            if (choice.delta?.content) {
              subject.next(JSON.stringify({ kind: 'text', content: choice.delta.content }));
            }
          } catch { /* skip malformed JSON */ }
        }
      }
      subject.complete();
    } catch (error) {
      subject.error(error);
    }
  }

  // ---- Agentic methods ----

  async agentTurn(params: AgentChatParams): Promise<ContentBlock[]> {
    const base = params.apiBaseUrl.replace(/\/+$/, '');
    const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

    const body = this.buildAgentBody(params, false);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`API error: ${response.status} ${await response.text()}`);

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('No choices in response');

    return this.parseOpenAiResponse(choice);
  }

  streamAgentTurn(params: AgentChatParams): Observable<string> {
    const subject = new Subject<string>();
    this.doStreamAgentTurn(params, subject);
    return subject.asObservable();
  }

  private buildAgentBody(params: AgentChatParams, stream: boolean): any {
    // Map ConversationMessage[] to OpenAI messages format
    const messages: any[] = [];
    if (params.systemPrompt) messages.push({ role: 'system', content: params.systemPrompt });

    for (const msg of params.messages) {
      if (msg.role === 'user') {
        // user messages: text blocks + tool_result blocks
        const textParts: string[] = [];
        const toolResults: any[] = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            textParts.push(block.text);
          } else if (block.type === 'tool_result') {
            toolResults.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: block.content,
            });
          }
        }
        if (textParts.length > 0) {
          messages.push({ role: 'user', content: textParts.join('\n') });
        }
        for (const tr of toolResults) {
          messages.push(tr);
        }
      } else {
        // assistant messages: text blocks + tool_use blocks
        const textParts: string[] = [];
        const toolCalls: any[] = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            textParts.push(block.text);
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            });
          }
        }
        const assistantMsg: any = { role: 'assistant' };
        if (textParts.length > 0) assistantMsg.content = textParts.join('\n');
        if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
        if (textParts.length > 0 || toolCalls.length > 0) {
          messages.push(assistantMsg);
        }
      }
    }

    const body: any = {
      model: params.modelId,
      messages,
      max_completion_tokens: params.maxTokens,
      stream,
    };

    // Map tool definitions
    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
      body.tool_choice = 'auto';
    }

    const isReasoningModel = params.modelId.startsWith('o') || params.reasoningEffort != null;
    if (!isReasoningModel) {
      body.temperature = params.temperature;
    }
    if (params.reasoningEffort) {
      body.reasoning_effort = params.reasoningEffort;
    }

    return body;
  }

  private parseOpenAiResponse(choice: any): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const message = choice.message;

    if (message?.content) {
      blocks.push({ type: 'text', text: message.content });
    }
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        let input: object = {};
        try {
          input = JSON.parse(tc.function?.arguments || '{}');
        } catch { /* keep empty */ }
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function?.name || '',
          input,
        });
      }
    }

    return blocks;
  }

  private async doStreamAgentTurn(params: AgentChatParams, subject: Subject<string>) {
    try {
      const base = params.apiBaseUrl.replace(/\/+$/, '');
      const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

      const body = this.buildAgentBody(params, true);
      subject.next(JSON.stringify({ kind: 'message_start' }));

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.apiKey}` },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`API error: ${response.status} ${await response.text()}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Track tool_call accumulation across chunks
      const toolCallAcc: Record<number, { id?: string; name?: string; arguments: string }> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') { subject.next(JSON.stringify({ kind: 'message_stop' })); subject.complete(); return; }
          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            // DeepSeek R1 reasoning_content
            if (choice.delta?.reasoning_content) {
              subject.next(JSON.stringify({ kind: 'thinking', content: choice.delta.reasoning_content }));
            }
            // Text delta
            if (choice.delta?.content) {
              subject.next(JSON.stringify({ kind: 'text', content: choice.delta.content }));
            }
            // Tool call delta
            if (choice.delta?.tool_calls && Array.isArray(choice.delta.tool_calls)) {
              for (const tc of choice.delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallAcc[idx]) toolCallAcc[idx] = { arguments: '' };
                const acc = toolCallAcc[idx];
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name = tc.function.name;
                if (tc.function?.arguments) acc.arguments += tc.function.arguments;
              }
            }
            // Check finish_reason for tool_calls — emit completed tool_use blocks
            if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
              for (const idx of Object.keys(toolCallAcc)) {
                const acc = toolCallAcc[Number(idx)];
                if (acc.id && acc.name) {
                  let input: object = {};
                  try { input = JSON.parse(acc.arguments); } catch { /* partial */ }
                  subject.next(JSON.stringify({
                    kind: 'tool_use',
                    id: acc.id,
                    name: acc.name,
                    input,
                  }));
                }
              }
              // Reset accumulator for next turn (shouldn't happen but safe)
              for (const k of Object.keys(toolCallAcc)) delete toolCallAcc[Number(k)];
            }
          } catch { /* skip */ }
        }
      }
      subject.next(JSON.stringify({ kind: 'message_stop' }));
      subject.complete();
    } catch (error) {
      subject.error(error);
    }
  }
}
