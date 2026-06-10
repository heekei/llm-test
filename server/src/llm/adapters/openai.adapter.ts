import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { LlmAdapter, StreamChatParams } from './adapter.interface';

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
}
