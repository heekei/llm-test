import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import type { AgentTraceStep } from '../types';

export interface RunPanel {
  key: string;
  runId?: string;
  providerId: string;
  providerName: string;
  modelId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  content: string;
  thinkingContent: string;
  latencyMs?: number | null;
  error?: string | null;
  score?: number | null;
  scoreNote?: string;
  aiScores?: any[] | null;
  savingScore?: boolean;
  scoreError?: string;
  // Agentic fields
  agentTrace: AgentTraceStep[];
  currentIteration: number;
}

export interface ActiveRun {
  taskId: string;
  panels: Record<string, RunPanel>;
}

export const useRunStore = defineStore('run', () => {
  const activeRuns = reactive<Record<string, ActiveRun>>({});
  const isStreaming = ref(false);

  function getRun(taskId: string): ActiveRun | undefined {
    return activeRuns[taskId];
  }

  function startRun(taskId: string, targets: { providerId: string; providerName: string; modelId: string }[]) {
    const panels: Record<string, RunPanel> = {};
    for (const t of targets) {
      const key = `${t.providerId}:${t.modelId}`;
      panels[key] = {
        key,
        providerId: t.providerId,
        providerName: t.providerName,
        modelId: t.modelId,
        status: 'pending',
        content: '',
        thinkingContent: '',
        agentTrace: [],
        currentIteration: 0,
      };
    }
    activeRuns[taskId] = { taskId, panels };
    isStreaming.value = true;
    return panels;
  }

  function setRunId(taskId: string, providerId: string, modelId: string, runId: string) {
    const run = activeRuns[taskId];
    if (!run) return;
    const key = `${providerId}:${modelId}`;
    const panel = run.panels[key];
    if (panel) {
      panel.runId = runId;
      panel.status = 'running';
    }
  }

  function appendDelta(taskId: string, runId: string, content: string) {
    const run = activeRuns[taskId];
    if (!run) return;
    for (const key in run.panels) {
      const panel = run.panels[key];
      if (panel.runId === runId) {
        panel.content += content;
        break;
      }
    }
  }

  function appendThinking(taskId: string, runId: string, content: string) {
    const run = activeRuns[taskId];
    if (!run) return;
    for (const key in run.panels) {
      const panel = run.panels[key];
      if (panel.runId === runId) {
        panel.thinkingContent += content;
        break;
      }
    }
  }

  function completeRun(taskId: string, runId: string, output: string, latencyMs?: number | null, thinkingOutput?: string | null) {
    const run = activeRuns[taskId];
    if (!run) return;
    for (const key in run.panels) {
      const panel = run.panels[key];
      if (panel.runId === runId) {
        panel.status = 'completed';
        panel.content = output || panel.content;
        panel.thinkingContent = thinkingOutput || panel.thinkingContent;
        panel.latencyMs = latencyMs ?? panel.latencyMs;
        break;
      }
    }
  }

  function setRunAiScores(taskId: string, runId: string, aiScores: any[]) {
    const run = activeRuns[taskId];
    if (!run) return;
    for (const key in run.panels) {
      const panel = run.panels[key];
      if (panel.runId === runId) {
        panel.aiScores = aiScores;
        break;
      }
    }
  }

  function errorRun(taskId: string, runId: string | undefined, error: string) {
    const run = activeRuns[taskId];
    if (!run) return;
    if (runId) {
      for (const key in run.panels) {
        const panel = run.panels[key];
        if (panel.runId === runId) {
          panel.status = 'error';
          panel.error = error;
          break;
        }
      }
    } else {
      for (const key in run.panels) {
        if (run.panels[key].status === 'pending' || run.panels[key].status === 'running') {
          run.panels[key].status = 'error';
          run.panels[key].error = error;
        }
      }
    }
  }

  function finishRun(taskId: string) {
    const run = activeRuns[taskId];
    if (!run) return;
    for (const key in run.panels) {
      if (run.panels[key].status === 'running') {
        run.panels[key].status = 'completed';
      }
    }
    isStreaming.value = false;
  }

  function clearRun(taskId: string) {
    delete activeRuns[taskId];
  }

  function isTaskRunning(): boolean {
    return isStreaming.value;
  }

  function getPanelByRunId(taskId: string, runId: string): RunPanel | undefined {
    const run = activeRuns[taskId];
    if (!run) return undefined;
    for (const key in run.panels) {
      if (run.panels[key].runId === runId) {
        return run.panels[key];
      }
    }
    return undefined;
  }

  // ---- Agentic evaluation methods ----

  function appendAgentTrace(taskId: string, runId: string, step: AgentTraceStep) {
    const run = activeRuns[taskId];
    if (!run) return;
    for (const key in run.panels) {
      const panel = run.panels[key];
      if (panel.runId === runId) {
        panel.agentTrace.push(step);
        break;
      }
    }
  }

  function setAgentIteration(taskId: string, runId: string, iteration: number) {
    const run = activeRuns[taskId];
    if (!run) return;
    for (const key in run.panels) {
      const panel = run.panels[key];
      if (panel.runId === runId) {
        panel.currentIteration = iteration;
        break;
      }
    }
  }

  return {
    activeRuns,
    isStreaming,
    getRun,
    startRun,
    setRunId,
    appendDelta,
    appendThinking,
    completeRun,
    setRunAiScores,
    errorRun,
    finishRun,
    clearRun,
    isTaskRunning,
    appendAgentTrace,
    setAgentIteration,
    getPanelByRunId,
  };
});
