<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Provider } from '../types';
import { listProviders, deleteProvider, fetchProviderModels } from '../api/providers';
import { Plus } from '@element-plus/icons-vue';
import { ElMessageBox, ElMessage } from 'element-plus';

const router = useRouter();
const providers = ref<Provider[]>([]);
const loading = ref(false);
const error = ref('');
const fetchingModels = ref<Set<string>>(new Set());

async function loadProviders() {
  loading.value = true;
  error.value = '';
  try {
    providers.value = await listProviders();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load providers';
  } finally {
    loading.value = false;
  }
}

async function handleFetchModels(provider: Provider) {
  fetchingModels.value.add(provider.id);
  try {
    const models = await fetchProviderModels(provider.id);
    ElMessage.success(`Fetched ${models.length} models for ${provider.name}`);
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : 'Failed to fetch models');
  } finally {
    fetchingModels.value.delete(provider.id);
  }
}

async function handleDelete(provider: Provider) {
  try {
    await ElMessageBox.confirm(
      `Delete provider "${provider.name}"? This cannot be undone.`,
      'Confirm Delete',
      { confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning' },
    );
    await deleteProvider(provider.id);
    await loadProviders();
  } catch {
    // cancelled
  }
}

function goNew() {
  router.push({ name: 'provider-new' });
}

function goEdit(provider: Provider) {
  router.push({ name: 'provider-edit', params: { id: provider.id } });
}

onMounted(loadProviders);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Providers</h1>
        <p class="subtitle">Configure LLM API providers used for evaluations.</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="goNew">New Provider</el-button>
    </div>

    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      <span>Loading providers...</span>
    </div>

    <el-alert v-else-if="error" :title="error" type="error" show-icon />

    <el-empty v-else-if="providers.length === 0" description="No providers yet">
      <el-button type="primary" @click="goNew">+ New Provider</el-button>
    </el-empty>

    <div v-else class="provider-grid">
      <el-card
        v-for="p in providers"
        :key="p.id"
        class="provider-card fade-in"
        shadow="hover"
      >
        <div class="provider-head">
          <div class="provider-name">
            <h3>{{ p.name }}</h3>
            <el-tag size="small">{{ p.adapterType }}</el-tag>
          </div>
          <el-tag :type="p.isEnabled ? 'success' : 'info'">
            {{ p.isEnabled ? 'Enabled' : 'Disabled' }}
          </el-tag>
        </div>

        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item label="Base URL">
            <span class="mono">{{ p.apiBaseUrl }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="API Key">
            <span class="mono">{{ p.apiKey || '••••••••' }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="provider-actions">
          <el-button
            size="small"
            :loading="fetchingModels.has(p.id)"
            @click="handleFetchModels(p)"
          >
            {{ fetchingModels.has(p.id) ? 'Fetching...' : 'Fetch Models' }}
          </el-button>
          <el-button size="small" @click="goEdit(p)">Edit</el-button>
          <el-button size="small" type="danger" @click="handleDelete(p)">Delete</el-button>
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

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.provider-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.provider-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.provider-name {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.provider-name h3 {
  margin: 0;
}

.mono {
  font-family: var(--mono);
  font-size: 12.5px;
  word-break: break-all;
}

.provider-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid var(--border-light);
  padding-top: 12px;
}
</style>
