<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from '@element-plus/icons-vue';
import type { TaskRun } from '../types';
import { compareRuns } from '../api/runs';
import { marked } from 'marked';
import AiScorePanel from '../components/runs/AiScorePanel.vue';

const route = useRoute();
const router = useRouter();
const taskId = computed(() => (route.params.taskId as string) || '');

const taskTitle = ref('');
const taskPrompt = ref('');
const runs = ref<TaskRun[]>([]);
const loading = ref(false);
const error = ref('');

const averageScore = computed(() => {
  const scored = runs.value.filter((r) => r.score != null);
  if (scored.length === 0) return null;
  return scored.reduce((sum, r) => sum + (r.score ?? 0), 0) / scored.length;
});

function renderMarkdown(content: string | null | undefined): string {
  if (!content) return '<p class="placeholder">No output</p>';
  return marked(content) as string;
}

function formatLatency(ms: number | null | undefined) {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(s: string | null | undefined) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

async function loadData() {
  if (!taskId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await compareRuns(taskId.value);
    taskTitle.value = result.task?.title || '';
    taskPrompt.value = result.task?.prompt || '';
    runs.value = result.runs || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load comparison';
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

marked.setOptions({
  breaks: true,
  gfm: true,
});
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <el-button :icon="ArrowLeft" @click="router.back()" text>Back</el-button>
        <h1>Compare Runs</h1>
      </div>
    </div>

    <el-empty v-if="!taskId" description="Select a task to compare">
      <template #extra>
        <p>Navigate to a task detail page and click "Compare Runs".</p>
      </template>
    </el-empty>

    <div v-else-if="loading" class="loading">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      <span>Loading comparison...</span>
    </div>

    <el-alert v-else-if="error" :title="error" type="error" show-icon />

    <template v-else>
      <el-empty v-if="runs.length === 0" description="No runs to compare">
        <template #extra>
          <el-button type="primary" @click="router.push({ name: 'task-detail', params: { id: taskId } })">
            Go to Task
          </el-button>
        </template>
      </el-empty>

      <template v-else>
        <el-card class="summary-bar" shadow="never">
          <div class="summary-item">
            <span class="summary-label">Task</span>
            <span class="summary-value">{{ taskTitle }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Runs</span>
            <span class="summary-value">{{ runs.length }}</span>
          </div>
          <div v-if="averageScore != null" class="summary-item">
            <span class="summary-label">Average Score</span>
            <span class="summary-value score">★ {{ averageScore.toFixed(1) }} / 5</span>
          </div>
        </el-card>

        <div class="compare-grid">
          <el-card v-for="r in runs" :key="r.id" class="compare-col" shadow="hover">
            <div class="col-header">
              <div class="col-title">
                <span class="provider-name">{{ r.provider?.name || 'Unknown' }}</span>
                <span class="sep">/</span>
                <span class="model-name">{{ r.modelId }}</span>
              </div>
              <el-tag
                :type="r.status === 'completed' ? 'success' : r.status === 'error' ? 'danger' : r.status === 'running' ? 'primary' : 'warning'"
                size="small"
              >{{ r.status }}</el-tag>
            </div>

            <div class="col-stats">
              <div v-if="r.latencyMs != null" class="stat">
                <span class="stat-label">Latency</span>
                <span class="stat-value mono">{{ formatLatency(r.latencyMs) }}</span>
              </div>
              <div v-if="r.score != null" class="stat">
                <span class="stat-label">Score</span>
                <span class="stat-value score">★ {{ r.score }}/5</span>
              </div>
              <div v-if="r.scoreNote" class="stat full">
                <span class="stat-label">Note</span>
                <span class="stat-value">{{ r.scoreNote }}</span>
              </div>
            </div>

            <div class="col-output markdown-body" v-html="renderMarkdown(r.output)"></div>

            <div v-if="r.aiScores && r.aiScores.length > 0" class="col-ai-scores">
              <el-card
                v-for="(score, idx) in r.aiScores"
                :key="idx"
                class="compare-ai-score"
                shadow="never"
              >
                <div class="compare-ai-score-header">
                  <span>Judge: {{ score.judgeModelId }}</span>
                </div>
                <AiScorePanel :ai-scores="score" />
              </el-card>
            </div>

            <div class="col-footer">
              {{ formatDate(r.createdAt) }}
            </div>
          </el-card>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header > div {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-header h1 {
  margin: 0;
}

.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  padding: 24px;
}

.summary-bar {
  display: flex;
  gap: 32px;
  align-items: center;
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 700;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-h);
}

.summary-value.score {
  color: var(--warning);
}

.compare-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}

.compare-col {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.compare-col :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
}

.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--border-light);
  border-bottom: 1px solid var(--border);
}

.col-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
}

.provider-name {
  color: var(--primary);
}

.sep {
  color: var(--text-muted);
}

.model-name {
  font-family: var(--mono);
  font-size: 12px;
}

.col-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stat.full {
  width: 100%;
}

.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 700;
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
}

.stat-value.score {
  color: var(--warning);
}

.mono {
  font-family: var(--mono);
}

.col-output {
  padding: 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-h);
  max-height: 500px;
  overflow-y: auto;
  flex: 1;
}

.col-output :deep(p) {
  margin: 0 0 12px;
}

.col-output :deep(p:last-child) {
  margin-bottom: 0;
}

.col-output :deep(pre) {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 13px;
  margin: 0 0 12px;
}

.col-output :deep(code) {
  font-family: var(--mono);
  font-size: 13px;
  padding: 2px 6px;
  background: var(--border-light);
  border-radius: 4px;
}

.col-output :deep(pre code) {
  padding: 0;
  background: none;
  border-radius: 0;
}

.col-output :deep(.placeholder) {
  color: var(--text-muted);
  font-style: italic;
}

.col-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border-light);
  font-size: 12px;
  color: var(--text-muted);
}

.col-ai-scores {
  padding: 0 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-ai-score-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light);
}
</style>
