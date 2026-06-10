import { ref } from 'vue';

export interface SseDeltaPayload {
  type: 'delta';
  runId: string;
  content: string;
}
export interface SseThinkingPayload {
  type: 'thinking';
  runId: string;
  content: string;
}
export interface SseCreatedPayload {
  type: 'created';
  runId: string;
  providerId: string;
  modelId: string;
}
export interface SseCompletePayload {
  type: 'complete';
  runId: string;
  output: string;
  thinkingOutput?: string | null;
  latencyMs: number;
  totalMs?: number;
}
export interface SseErrorPayload {
  type: 'error';
  runId?: string;
  error: string;
}
export interface SseDonePayload {
  type: 'done';
}

export type SseEvent =
  | SseDeltaPayload
  | SseThinkingPayload
  | SseCreatedPayload
  | SseCompletePayload
  | SseErrorPayload
  | SseDonePayload;

export interface UseSseOptions {
  onCreated?: (runId: string, providerId: string, modelId: string) => void;
  onThinking?: (runId: string, content: string) => void;
  onDelta?: (runId: string, content: string) => void;
  onComplete?: (runId: string, data: SseCompletePayload) => void;
  onError?: (runId: string | undefined, error: string) => void;
  onDone?: () => void;
}

export function useSse(opts: UseSseOptions = {}) {
  const isStreaming = ref(false);
  let controller: AbortController | null = null;

  async function startStream(url: string, body: unknown): Promise<void> {
    if (isStreaming.value) {
      stopStream();
    }
    controller = new AbortController();
    isStreaming.value = true;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `HTTP ${res.status}`;
        try {
          const txt = await res.text();
          if (txt) msg = txt;
        } catch (_) {
          /* ignore */
        }
        opts.onError?.(undefined, msg);
        opts.onDone?.();
        isStreaming.value = false;
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE messages are separated by \n\n
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          handleRawEvent(rawEvent);
        }
      }
      // Process anything remaining
      if (buffer.trim()) {
        handleRawEvent(buffer);
      }
    } catch (err: unknown) {
      if (controller?.signal.aborted) {
        // intentional stop
      } else {
        const msg =
          err instanceof Error ? err.message : 'Unknown stream error';
        opts.onError?.(undefined, msg);
      }
    } finally {
      isStreaming.value = false;
      opts.onDone?.();
    }
  }

  function handleRawEvent(raw: string) {
    // Each event may have multiple "data:" lines; collect their JSON payloads
    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      if (jsonStr === '[DONE]') continue;
      let evt: SseEvent;
      try {
        evt = JSON.parse(jsonStr) as SseEvent;
      } catch (e) {
        console.warn('[SSE] Failed to parse JSON:', jsonStr, e);
        continue;
      }
      dispatch(evt);
    }
  }

  function dispatch(evt: SseEvent) {
    switch (evt.type) {
      case 'created':
        opts.onCreated?.(evt.runId, evt.providerId, evt.modelId);
        break;
      case 'thinking':
        opts.onThinking?.(evt.runId, evt.content);
        break;
      case 'delta':
        opts.onDelta?.(evt.runId, evt.content);
        break;
      case 'complete':
        opts.onComplete?.(evt.runId, evt);
        break;
      case 'error':
        opts.onError?.(evt.runId, evt.error);
        break;
      case 'done':
        // onDone called in finally block; but call here too in case stream stays open
        break;
    }
  }

  function stopStream() {
    if (controller) {
      controller.abort();
      controller = null;
    }
    isStreaming.value = false;
  }

  return { startStream, stopStream, isStreaming };
}
