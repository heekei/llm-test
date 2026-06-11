<script setup lang="ts">
import { onMounted, ref, reactive, computed, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft } from '@element-plus/icons-vue';
import type { RunTarget, Task, TaskRun, AiScoreResult, ModelInfo } from '../types';
import { getTask, deleteTask, getRunStreamUrl } from '../api/tasks';
import { scoreRun, aiScoreRun, getAiScoreStatus, deleteAiScore } from '../api/runs';
import { getAllModels } from '../api/providers';
import { useSse } from '../composables/useSse';
import { useRunStore } from '../stores/runStore';
import ModelSelector from '../components/tasks/ModelSelector.vue';
import StreamingOutput from '../components/runs/StreamingOutput.vue';
import AiScorePanel from '../components/runs/AiScorePanel.vue';
import AgentTrace from '../components/runs/AgentTrace.vue';
import { ElMessageBox, ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const taskId = computed(() => route.params.id as string);
const runStore = useRunStore();

const task = ref<Task | null>(null);
const loading = ref(false);
const loadError = ref('');
const targets = ref<RunTarget[]>([]);

interface RunPanel {
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
  aiScores?: AiScoreResult[] | null;
  savingScore?: boolean;
  scoreError?: string;
  agentTrace?: any[];
  currentIteration?: number;
}

const runPanels = reactive<Record<string, RunPanel>>({});

let syncTimer: ReturnType<typeof setInterval> | null = null;

function syncFromStore() {
  const stored = runStore.getRun(taskId.value);
  if (!stored) {
    for (const k of Object.keys(runPanels)) delete runPanels[k];
    return;
  }
  for (const key in stored.panels) {
    const sp = stored.panels[key];
    if (!runPanels[key]) {
      runPanels[key] = { ...sp };
    } else {
      const lp = runPanels[key];
      lp.runId = sp.runId;
      lp.status = sp.status;
      lp.content = sp.content;
      lp.thinkingContent = sp.thinkingContent;
      lp.latencyMs = sp.latencyMs;
      lp.error = sp.error;
      lp.aiScores = sp.aiScores;
      lp.agentTrace = sp.agentTrace;
      lp.currentIteration = sp.currentIteration;
    }
  }
  for (const key of Object.keys(runPanels)) {
    if (!stored.panels[key]) delete runPanels[key];
  }
}

const { startStream, stopStream } = useSse({
  onCreated: (runId, providerId, modelId) => {
    runStore.setRunId(taskId.value, providerId, modelId, runId);
  },
  onThinking: (runId, content) => {
    runStore.appendThinking(taskId.value, runId, content);
    const panel = runStore.getPanelByRunId(taskId.value, runId);
    if (panel && panel.currentIteration > 0) {
      runStore.appendAgentTrace(taskId.value, runId, {
        iteration: panel.currentIteration,
        kind: 'thinking',
        content,
        timestamp: new Date().toISOString(),
      });
    }
  },
  onDelta: (runId, content) => {
    runStore.appendDelta(taskId.value, runId, content);
    const panel = runStore.getPanelByRunId(taskId.value, runId);
    if (panel && panel.currentIteration > 0) {
      runStore.appendAgentTrace(taskId.value, runId, {
        iteration: panel.currentIteration,
        kind: 'llm_text',
        content,
        timestamp: new Date().toISOString(),
      });
    }
  },
  onComplete: (runId, data) => {
    runStore.completeRun(taskId.value, runId, data.output, data.latencyMs, data.thinkingOutput);
  },
  onError: (runId, errMsg) => {
    runStore.errorRun(taskId.value, runId, errMsg);
  },
  onDone: () => {
    runStore.finishRun(taskId.value);
    loadTask();
  },
  onAgentIteration: (runId, iteration) => {
    runStore.setAgentIteration(taskId.value, runId, iteration);
  },
  onToolCall: (runId, data) => {
    runStore.appendAgentTrace(taskId.value, runId, {
      iteration: 0, // filled by agent_iteration separately
      kind: 'tool_call',
      content: '',
      toolName: data.toolName,
      toolCallId: data.toolCallId,
      toolInput: data.input,
      timestamp: new Date().toISOString(),
    });
  },
  onToolResult: (runId, data) => {
    runStore.appendAgentTrace(taskId.value, runId, {
      iteration: 0,
      kind: 'tool_result',
      content: data.result,
      toolCallId: data.toolCallId,
      isError: data.isError,
      timestamp: new Date().toISOString(),
    });
  },
});

const isStreaming = computed(() => runStore.isStreaming);

async function loadTask() {
  loading.value = true;
  loadError.value = '';
  try {
    task.value = await getTask(taskId.value);
    if (task.value?.defaultTargets && task.value.defaultTargets.length > 0) {
      targets.value = task.value.defaultTargets;
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load task';
  } finally {
    loading.value = false;
  }
}

async function runTargets() {
  if (targets.value.length === 0) return;
  runStore.clearRun(taskId.value);
  const targetList = targets.value.map((t) => ({
    providerId: t.providerId,
    providerName: t.providerName,
    modelId: t.modelId,
  }));
  runStore.startRun(taskId.value, targetList);
  syncFromStore();
  await startStream(getRunStreamUrl(taskId.value), {
    targets: targets.value.map((t) => ({
      providerId: t.providerId,
      modelId: t.modelId,
    })),
  });
}

async function submitScore(panel: RunPanel) {
  if (!panel.runId || panel.score == null) return;
  panel.savingScore = true;
  panel.scoreError = '';
  try {
    await scoreRun(panel.runId, panel.score, panel.scoreNote);
    await loadTask();
  } catch (err) {
    panel.scoreError = err instanceof Error ? err.message : 'Failed to save score';
  } finally {
    panel.savingScore = false;
  }
}

async function handleDeleteTask() {
  if (!task.value) return;
  try {
    await ElMessageBox.confirm(
      t('taskDetail.confirmDeleteTask', { title: task.value.title }),
      t('taskDetail.confirmDeleteTitle'),
      { confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel'), type: 'warning' },
    );
    await deleteTask(task.value.id);
    router.push({ name: 'tasks' });
  } catch {
    // cancelled
  }
}

// AI Score dialog state
const showAiScoreDialog = ref(false);
const aiScoreTargetRunId = ref<string>('');
const aiScoreTargetRunLabel = ref('');
const judgeModelId = ref('');
const aiScoreLoading = ref(false);
const aiScoreError = ref('');
const allJudgeModels = ref<ModelInfo[]>([]);

const scoringRunIds = ref<Set<string>>(new Set());

const judgeModelsByProvider = computed(() => {
  const groups: Record<string, ModelInfo[]> = {};
  for (const m of allJudgeModels.value) {
    if (!groups[m.providerId]) groups[m.providerId] = [];
    groups[m.providerId].push(m);
  }
  return groups;
});

async function loadJudgeModels() {
  try {
    allJudgeModels.value = await getAllModels();
  } catch {
    // ignore
  }
}

function openAiScoreDialog(runId: string, label: string) {
  aiScoreTargetRunId.value = runId;
  aiScoreTargetRunLabel.value = label;
  judgeModelId.value = '';
  aiScoreError.value = '';
  showAiScoreDialog.value = true;
}

function closeAiScoreDialog() {
  showAiScoreDialog.value = false;
}

async function handleDeleteAiScore(runId: string, index: number) {
  try {
    await deleteAiScore(runId, index);
    await loadTask();
    ElMessage.success('AI score deleted');
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : 'Failed to delete AI score');
  }
}

async function submitAiScore() {
  if (!aiScoreTargetRunId.value || !judgeModelId.value) return;
  const model = allJudgeModels.value.find((m) => m.id === judgeModelId.value);
  if (!model) return;
  aiScoreLoading.value = true;
  aiScoreError.value = '';
  try {
    const res = await aiScoreRun(aiScoreTargetRunId.value, model.providerId, model.modelId);
    if (res.processing) {
      scoringRunIds.value = new Set(scoringRunIds.value).add(aiScoreTargetRunId.value);
    }
    closeAiScoreDialog();
    if (res.processing) pollAiScore(aiScoreTargetRunId.value);
  } catch (err) {
    aiScoreError.value = err instanceof Error ? err.message : 'AI score failed';
  } finally {
    aiScoreLoading.value = false;
  }
}

async function pollAiScore(runId: string) {
  const poll = async () => {
    try {
      const status = await getAiScoreStatus(runId);
      if (status.processing) {
        setTimeout(poll, 1500);
      } else {
        scoringRunIds.value = new Set([...scoringRunIds.value].filter((id) => id !== runId));
        const refreshedTask = await getTask(taskId.value);
        const updatedRun = refreshedTask.runs?.find((r: any) => r.id === runId);
        if (updatedRun?.aiScores) {
          runStore.setRunAiScores(taskId.value, runId, updatedRun.aiScores);
        }
        await loadTask();
      }
    } catch {
      setTimeout(poll, 2000);
    }
  };
  setTimeout(poll, 1500);
}

const activePanels = computed(() => Object.values(runPanels));

const pastRuns = computed<TaskRun[]>(() => {
  if (!task.value?.runs) return [];
  const activeRunIds = new Set(activePanels.value.map((p) => p.runId).filter(Boolean));
  return task.value.runs.filter((r) => !activeRunIds.has(r.id));
});

const expandedRunId = ref<string | null>(null);
const expandedThinking = ref<Set<string>>(new Set());

function togglePastThinking(runId: string) {
  if (expandedThinking.value.has(runId)) {
    expandedThinking.value.delete(runId);
  } else {
    expandedThinking.value.add(runId);
  }
}

function formatDate(s: string | null | undefined) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function formatLatency(ms: number | null | undefined) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

onMounted(async () => {
  await loadTask();
  syncFromStore();
  await loadJudgeModels();

  if (task.value?.runs) {
    const runningRuns = task.value.runs.filter(r => r.status === 'running');
    if (runningRuns.length > 0 && !runStore.getRun(taskId.value)) {
      const targetList = runningRuns.map(r => ({
        providerId: r.providerId || '',
        providerName: r.provider?.name || 'Unknown',
        modelId: r.modelId,
      }));
      runStore.startRun(taskId.value, targetList);
      for (const r of runningRuns) {
        runStore.setRunId(taskId.value, r.providerId || '', r.modelId, r.id);
        if (r.thinkingOutput) {
          runStore.appendThinking(taskId.value, r.id, r.thinkingOutput);
        }
        if (r.output) {
          runStore.appendDelta(taskId.value, r.id, r.output);
        }
        if (r.aiScores && r.aiScores.length > 0) {
          runStore.setRunAiScores(taskId.value, r.id, r.aiScores);
        }
      }
      syncFromStore();
    }

    for (const r of task.value.runs) {
      try {
        const status = await getAiScoreStatus(r.id);
        if (status.processing) {
          scoringRunIds.value = new Set(scoringRunIds.value).add(r.id);
          pollAiScore(r.id);
        }
      } catch { /* ignore */ }
    }
  }
  syncTimer = setInterval(syncFromStore, 100);
});

onUnmounted(() => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
});
</script>

<template>
  <div class="page">
    <div v-if="loading && !task" class="loading">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      <span>{{ t('taskDetail.loadingTask') }}</span>
    </div>

    <el-alert v-else-if="loadError" :title="loadError" type="error" show-icon />

    <template v-else-if="task">
      <div class="page-header">
        <div class="header-left">
          <el-button :icon="ArrowLeft" @click="router.push({ name: 'tasks' })" text>{{ t('taskDetail.back') }}</el-button>
          <div>
            <h1>{{ task.title }}</h1>
            <p v-if="task.description" class="subtitle">{{ task.description }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button @click="router.push({ name: 'compare', params: { taskId: task.id } })">
            {{ t('taskDetail.compareRuns') }}
          </el-button>
          <el-button type="danger" @click="handleDeleteTask">{{ t('common.delete') }}</el-button>
        </div>
      </div>

      <el-card class="task-info">
        <el-row :gutter="24">
          <el-col :span="12">
            <div class="info-col">
              <h3>{{ t('taskDetail.prompt') }}</h3>
              <pre class="prompt-block">{{ task.prompt }}</pre>
            </div>
          </el-col>
          <el-col v-if="task.systemPrompt" :span="12">
            <div class="info-col">
              <h3>{{ t('taskDetail.systemPrompt') }}</h3>
              <pre class="prompt-block">{{ task.systemPrompt }}</pre>
            </div>
          </el-col>
        </el-row>
        <div class="task-params">
          <el-tag>temperature: {{ task.temperature }}</el-tag>
          <el-tag type="info">max tokens: {{ task.maxTokens }}</el-tag>
          <el-tag type="info">created: {{ formatDate(task.createdAt) }}</el-tag>
        </div>
      </el-card>

      <el-card>
        <h2>{{ t('taskDetail.runOnModels') }}</h2>
        <p class="section-desc">{{ t('taskDetail.runOnModelsDesc') }}</p>
        <ModelSelector v-model:targets="targets" />
        <div class="run-actions">
          <el-button
            type="primary"
            :disabled="targets.length === 0 || isStreaming"
            :loading="isStreaming"
            @click="runTargets"
          >
            {{ isStreaming ? t('taskDetail.running') : t('taskDetail.runButton', { count: targets.length }) }}
          </el-button>
          <el-button
            v-if="isStreaming"
            @click="stopStream"
            type="warning"
          >{{ t('taskDetail.stop') }}</el-button>
        </div>
      </el-card>

      <div v-if="activePanels.length > 0" class="run-panels">
        <h2>{{ t('taskDetail.liveOutput') }}</h2>
        <div class="panel-grid">
          <div v-for="panel in activePanels" :key="panel.key" class="panel-wrap">
            <StreamingOutput
              :run-id="panel.runId || ''"
              :model-id="panel.modelId"
              :provider-name="panel.providerName"
              :content="panel.content"
              :thinking-content="panel.thinkingContent"
              :status="panel.status"
              :latency-ms="panel.latencyMs"
              :error="panel.error"
              :agent-trace="panel.agentTrace"
              :current-iteration="panel.currentIteration"
            />
            <div v-if="panel.status === 'completed' && panel.runId" class="score-block">
              <el-card shadow="hover">
                <h3>{{ t('taskDetail.scoreThis') }}</h3>
                <div class="score-row">
                  <div class="stars">
                    <button
                      v-for="n in 5"
                      :key="n"
                      type="button"
                      :class="['star', { active: (panel.score ?? 0) >= n }]"
                      @click="panel.score = n"
                      :aria-label="`Score ${n} stars`"
                    >★</button>
                  </div>
                  <el-input
                    v-model="panel.scoreNote"
                    :placeholder="t('taskDetail.scorePlaceholder')"
                    size="small"
                  />
                  <el-button
                    type="primary"
                    size="small"
                    :disabled="panel.score == null || panel.savingScore"
                    :loading="panel.savingScore"
                    @click="submitScore(panel)"
                  >
                    {{ t('common.save') }}
                  </el-button>
                </div>
                <el-alert v-if="panel.scoreError" :title="panel.scoreError" type="error" show-icon style="margin-top: 8px" />
                <div class="ai-score-actions">
                  <el-button
                    size="small"
                    :loading="scoringRunIds.has(panel.runId!)"
                    :disabled="scoringRunIds.has(panel.runId!)"
                    @click="openAiScoreDialog(panel.runId!, `${panel.providerName} / ${panel.modelId}`)"
                  >
                    {{ scoringRunIds.has(panel.runId!) ? t('taskDetail.scoring') : t('taskDetail.aiScore') }}
                  </el-button>
                </div>

                <div v-if="panel.aiScores && panel.aiScores.length > 0" class="ai-score-section">
                  <el-card
                    v-for="(score, idx) in panel.aiScores"
                    :key="idx"
                    class="ai-score-panel"
                    shadow="never"
                  >
                    <div class="ai-score-header">
                      <span class="ai-score-judge">
                        {{ t('taskDetail.judge') }}: {{ score.judgeModelId }}
                        <span class="ai-score-date">{{ formatDate(score.judgedAt) }}</span>
                      </span>
                      <el-button
                        type="danger"
                        size="small"
                        :icon="'Delete'"
                        circle
                        text
                        title="Delete this score"
                        @click="handleDeleteAiScore(panel.runId!, idx)"
                      />
                    </div>
                    <AiScorePanel :ai-scores="score" />
                  </el-card>
                </div>
              </el-card>
            </div>
          </div>
        </div>
      </div>

      <el-card>
        <h2>{{ t('taskDetail.pastRuns') }} <span class="count">({{ pastRuns.length }})</span></h2>
        <el-empty v-if="pastRuns.length === 0" :description="t('taskDetail.noPastRuns')" />

        <div v-else class="past-runs">
          <div
            v-for="r in pastRuns"
            :key="r.id"
            class="past-run-item"
          >
            <div
              class="past-run"
              @click="expandedRunId = expandedRunId === r.id ? null : r.id"
              role="button"
              tabindex="0"
            >
              <div class="run-meta">
                <span class="run-provider">{{ r.provider?.name || 'Unknown provider' }}</span>
                <span class="run-model mono">{{ r.modelId }}</span>
                <el-tag
                  :type="r.status === 'completed' ? 'success' : r.status === 'error' ? 'danger' : r.status === 'running' ? 'primary' : 'warning'"
                  size="small"
                >{{ t(`status.${r.status}`) }}</el-tag>
              </div>
              <div class="run-stats">
                <span v-if="r.latencyMs != null" class="stat">{{ formatLatency(r.latencyMs) }}</span>
                <span v-if="r.score != null" class="stat score">★ {{ r.score }}/5</span>
                <span class="stat">{{ formatDate(r.createdAt) }}</span>
              </div>
            </div>
            <div v-if="expandedRunId === r.id" class="run-output">
              <div v-if="r.thinkingOutput && !(r.agentTrace?.some((s: any) => s.kind === 'thinking'))" class="thinking-section-past">
                <el-button
                  text
                  class="thinking-toggle"
                  @click="togglePastThinking(r.id)"
                >
                  <span :class="['toggle-arrow', { open: expandedThinking.has(r.id) }]">&#9654;</span>
                  {{ t('taskDetail.thinking') }}
                </el-button>
                <pre v-show="expandedThinking.has(r.id)" class="thinking-body-past">{{ r.thinkingOutput }}</pre>
              </div>

              <pre v-if="r.output">{{ r.output }}</pre>
              <pre v-else-if="r.error" class="output-error">{{ r.error }}</pre>
              <p v-else class="output-empty">{{ t('taskDetail.noOutput') }}</p>

              <!-- Agent Trace in past runs -->
              <div v-if="r.agentTrace && r.agentTrace.length > 0" class="agent-trace-section">
                <AgentTrace
                  :trace="r.agentTrace"
                  :current-iteration="0"
                  :live="false"
                />
              </div>

              <div v-if="r.aiScores && r.aiScores.length > 0" class="ai-score-section">
                <el-card
                  v-for="(score, idx) in r.aiScores"
                  :key="idx"
                  class="ai-score-panel"
                  shadow="never"
                >
                  <div class="ai-score-header">
                    <span class="ai-score-judge">
                      Judge: {{ score.judgeModelId }}
                      <span class="ai-score-date">{{ formatDate(score.judgedAt) }}</span>
                    </span>
                    <el-button
                      type="danger"
                      size="small"
                      :icon="'Delete'"
                      circle
                      text
                      title="Delete this score"
                      @click.stop="handleDeleteAiScore(r.id, idx)"
                    />
                  </div>
                  <AiScorePanel :ai-scores="score" />
                </el-card>
              </div>

              <div class="run-actions-row">
                <div v-if="r.score != null" class="human-score">
                  <span class="score-label">{{ t('taskDetail.humanScore') }}</span>
                  <span class="stars-display">{{ '★'.repeat(r.score) }}{{ '☆'.repeat(5 - r.score) }}</span>
                  <span v-if="r.scoreNote" class="score-note">{{ r.scoreNote }}</span>
                </div>
                <el-button
                  size="small"
                  :loading="scoringRunIds.has(r.id)"
                  :disabled="scoringRunIds.has(r.id)"
                  @click.stop="openAiScoreDialog(r.id, `${r.provider?.name || t('common.unknown')} / ${r.modelId}`)"
                >
                  {{ scoringRunIds.has(r.id) ? t('taskDetail.scoring') : t('taskDetail.aiScore') }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- AI Score Dialog -->
      <el-dialog
        v-model="showAiScoreDialog"
        :title="t('taskDetail.aiScoreDialog')"
        width="480px"
        :close-on-click-modal="false"
        @close="closeAiScoreDialog"
      >
        <p class="dialog-desc">
          {{ t('taskDetail.aiScoreDialogDesc') }} <strong>{{ aiScoreTargetRunLabel }}</strong>
        </p>
        <el-form label-position="top">
          <el-form-item :label="t('taskDetail.judgeModel')">
            <el-select v-model="judgeModelId" style="width: 100%" :placeholder="t('taskDetail.judgeModelPlaceholder')">
              <el-option-group
                v-for="(models, providerId) in judgeModelsByProvider"
                :key="providerId"
                :label="models[0].provider?.name || providerId"
              >
                <el-option
                  v-for="m in models"
                  :key="m.id"
                  :label="m.name || m.modelId"
                  :value="m.id"
                />
              </el-option-group>
            </el-select>
          </el-form-item>
        </el-form>
        <el-alert v-if="aiScoreError" :title="aiScoreError" type="error" show-icon style="margin-top: 8px" />

        <template #footer>
          <el-button @click="closeAiScoreDialog">{{ t('common.cancel') }}</el-button>
          <el-button
            type="primary"
            :disabled="!judgeModelId || aiScoreLoading"
            :loading="aiScoreLoading"
            @click="submitAiScore"
          >
            {{ aiScoreLoading ? t('taskDetail.submitting') : t('taskDetail.startAiScore') }}
          </el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.subtitle {
  color: var(--text-muted);
  margin-top: 4px;
  font-size: 14px;
}

.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  padding: 24px;
}

.task-params {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.info-col h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.prompt-block {
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  padding: 12px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-h);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}

.section-desc {
  color: var(--text-muted);
  font-size: 13px;
  margin: 4px 0 16px;
}

.run-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.run-panels h2 {
  margin-bottom: 12px;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}

.panel-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.score-block h3 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.score-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
}

.stars {
  display: flex;
  gap: 2px;
}

.star {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--border);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.15s, transform 0.15s;
}

.star:hover {
  background: transparent;
  color: var(--warning);
  transform: scale(1.1);
}

.star.active {
  color: var(--warning);
}

.count {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 400;
}

.past-runs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.past-run {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.past-run:hover {
  background: var(--border-light);
}

.run-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.run-provider {
  font-weight: 600;
  color: var(--text-h);
}

.run-model {
  color: var(--text-muted);
}

.run-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 12px;
}

.stat.score {
  color: var(--warning);
  font-weight: 600;
}

.mono {
  font-family: var(--mono);
}

.run-output {
  padding: 12px;
  border-top: 1px solid var(--border-light);
}

.run-output pre {
  margin: 0;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  font-family: var(--mono);
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
}

.thinking-section-past {
  margin-bottom: 8px;
}

.thinking-body-past {
  margin: 0;
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: var(--radius);
  padding: 10px 12px;
  font-family: var(--mono);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  color: #92400e;
}

.toggle-arrow {
  font-size: 10px;
  transition: transform 0.2s;
  display: inline-block;
}

.toggle-arrow.open {
  transform: rotate(90deg);
}

.output-error {
  color: var(--error);
}

.output-empty {
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
  padding: 12px;
}

.ai-score-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.run-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.human-score {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.score-label {
  color: var(--text-muted);
  font-weight: 500;
}

.stars-display {
  color: var(--warning);
  letter-spacing: 1px;
}

.score-note {
  color: var(--text-muted);
  font-size: 12px;
}

.ai-score-section {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-score-panel {
  /* wrapped in el-card */
}

.ai-score-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
}

.ai-score-judge {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.ai-score-date {
  font-weight: 400;
  color: var(--text-muted);
  margin-left: 8px;
  font-size: 11px;
}

.dialog-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text);
}

@media (max-width: 600px) {
  .score-row {
    grid-template-columns: 1fr;
  }
}
</style>
