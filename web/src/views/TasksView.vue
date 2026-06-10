<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Task } from '../types';
import { listTasks } from '../api/tasks';
import { Plus } from '@element-plus/icons-vue';

const router = useRouter();
const tasks = ref<Task[]>([]);
const loading = ref(false);
const error = ref('');

async function loadTasks() {
  loading.value = true;
  error.value = '';
  try {
    tasks.value = await listTasks();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load tasks';
  } finally {
    loading.value = false;
  }
}

function truncate(str: string | null | undefined, n: number): string {
  if (!str) return '';
  if (str.length <= n) return str;
  return str.slice(0, n) + '...';
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function goNew() {
  router.push({ name: 'task-new' });
}

function goDetail(task: Task) {
  router.push({ name: 'task-detail', params: { id: task.id } });
}

onMounted(loadTasks);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Tasks</h1>
        <p class="subtitle">Evaluation prompts you can run against any configured model.</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="goNew">New Task</el-button>
    </div>

    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      <span>Loading tasks...</span>
    </div>

    <el-alert v-else-if="error" :title="error" type="error" show-icon />

    <el-empty v-else-if="tasks.length === 0" description="No tasks yet">
      <el-button type="primary" @click="goNew">+ New Task</el-button>
    </el-empty>

    <div v-else class="task-list">
      <el-card
        v-for="t in tasks"
        :key="t.id"
        class="task-card fade-in"
        shadow="hover"
        @click="goDetail(t)"
      >
        <div class="task-head">
          <h3>{{ t.title }}</h3>
          <el-tag>{{ t._count?.runs ?? 0 }} runs</el-tag>
        </div>
        <p v-if="t.description" class="task-desc">{{ truncate(t.description, 140) }}</p>
        <div class="prompt-preview">
          <span class="label">Prompt</span>
          <span class="text">{{ truncate(t.prompt, 200) }}</span>
        </div>
        <div class="task-meta">
          <span>Created {{ formatDate(t.createdAt) }}</span>
          <el-tag size="small" type="info">temp {{ t.temperature }}</el-tag>
          <el-tag size="small" type="info">max {{ t.maxTokens }} tok</el-tag>
        </div>
      </el-card>
    </div>
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

.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  padding: 24px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  cursor: pointer;
  transition: border-color 0.15s;
}

.task-card:hover {
  border-color: var(--primary-border);
}

.task-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.task-desc {
  font-size: 13.5px;
  color: var(--text);
  margin: 8px 0;
}

.prompt-preview {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  font-size: 13px;
  font-family: var(--mono);
  color: var(--text-h);
  line-height: 1.5;
  margin-bottom: 8px;
}

.prompt-preview .label {
  font-family: var(--sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-top: 1px;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
</style>
