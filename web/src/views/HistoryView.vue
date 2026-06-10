<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { TaskRun } from '../types';
import { listRuns } from '../api/runs';

const router = useRouter();
const runs = ref<TaskRun[]>([]);
const loading = ref(false);
const error = ref('');
const statusFilter = ref('');

const filteredRuns = computed(() => {
  if (!statusFilter.value) return runs.value;
  return runs.value.filter((r) => r.status === statusFilter.value);
});

async function loadRuns() {
  loading.value = true;
  error.value = '';
  try {
    runs.value = await listRuns();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load runs';
  } finally {
    loading.value = false;
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
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function goTask(run: TaskRun) {
  router.push({ name: 'task-detail', params: { id: run.taskId } });
}

const statusTagType: Record<string, string> = {
  completed: 'success',
  error: 'danger',
  running: 'primary',
  pending: 'warning',
};

onMounted(loadRuns);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>History</h1>
        <p class="subtitle">All evaluation runs across every task.</p>
      </div>
      <div class="filters">
        <span class="filter-label">Status</span>
        <el-select v-model="statusFilter" placeholder="All" clearable style="width: 140px">
          <el-option label="Completed" value="completed" />
          <el-option label="Error" value="error" />
          <el-option label="Running" value="running" />
          <el-option label="Pending" value="pending" />
        </el-select>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      <span>Loading runs...</span>
    </div>

    <el-alert v-else-if="error" :title="error" type="error" show-icon />

    <el-empty v-else-if="filteredRuns.length === 0" :description="statusFilter ? 'Try a different filter.' : 'Run a task to populate this list.'">
      <template v-if="statusFilter">
        <el-button @click="statusFilter = ''">Clear Filter</el-button>
      </template>
    </el-empty>

    <el-card v-else class="runs-table-wrap" shadow="never">
      <el-table
        :data="filteredRuns"
        stripe
        style="width: 100%"
        @row-click="goTask"
        row-style="cursor: pointer"
      >
        <el-table-column label="Task" prop="task.title" sortable="custom">
          <template #default="{ row }">
            <span class="task-title">{{ row.task?.title || 'Unknown' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Provider" prop="provider.name">
          <template #default="{ row }">
            {{ row.provider?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="Model" prop="modelId">
          <template #default="{ row }">
            <span class="mono">{{ row.modelId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Status" prop="status" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType[row.status] || 'info'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Latency" prop="latencyMs" width="100" sortable="custom">
          <template #default="{ row }">
            <span class="mono">{{ formatLatency(row.latencyMs) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Score" prop="score" width="80" sortable="custom">
          <template #default="{ row }">
            <span v-if="row.score != null" class="score">★ {{ row.score }}</span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="Created" prop="createdAt" width="170" sortable="custom">
          <template #default="{ row }">
            <span class="muted">{{ formatDate(row.createdAt) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
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

.subtitle {
  color: var(--text-muted);
  margin-top: 4px;
  font-size: 14px;
}

.filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  padding: 24px;
}

.task-title {
  font-weight: 600;
}

.mono {
  font-family: var(--mono);
  font-size: 12.5px;
}

.muted {
  color: var(--text-muted);
}

.score {
  color: var(--warning);
  font-weight: 600;
}

.runs-table-wrap :deep(.el-card__body) {
  padding: 0;
}
</style>
