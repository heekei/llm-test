<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from '@element-plus/icons-vue';
import type { CreateProviderInput } from '../types';
import { createProvider, getProvider, updateProvider } from '../api/providers';

const route = useRoute();
const router = useRouter();

const isEdit = computed(() => route.name === 'provider-edit');
const providerId = computed(() => (route.params.id as string) || '');

const form = ref<CreateProviderInput>({
  name: '',
  apiBaseUrl: '',
  apiKey: '',
  adapterType: 'openai',
});

const formRef = ref();
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const fetchError = ref('');

const rules = {
  name: [{ required: true, message: 'Name is required', trigger: 'blur' }],
  apiBaseUrl: [{ required: true, message: 'API Base URL is required', trigger: 'blur' }],
  apiKey: [{ required: true, message: 'API Key is required', trigger: 'blur' }],
  adapterType: [{ required: true, message: 'Adapter type is required', trigger: 'change' }],
};

async function loadProvider() {
  if (!isEdit.value || !providerId.value) return;
  loading.value = true;
  fetchError.value = '';
  try {
    const p = await getProvider(providerId.value);
    form.value = {
      name: p.name,
      apiBaseUrl: p.apiBaseUrl,
      apiKey: '',
      adapterType: p.adapterType,
    };
  } catch (err) {
    fetchError.value = err instanceof Error ? err.message : 'Failed to load provider';
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  error.value = '';
  try {
    if (isEdit.value) {
      const update: Record<string, unknown> = {
        name: form.value.name,
        apiBaseUrl: form.value.apiBaseUrl,
        adapterType: form.value.adapterType,
      };
      if (form.value.apiKey) {
        update.apiKey = form.value.apiKey;
      }
      await updateProvider(providerId.value, update);
    } else {
      await createProvider(form.value);
    }
    router.push({ name: 'providers' });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save provider';
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push({ name: 'providers' });
}

onMounted(loadProvider);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack" text>Back</el-button>
      <h1>{{ isEdit ? 'Edit Provider' : 'New Provider' }}</h1>
    </div>

    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      <span>Loading provider...</span>
    </div>

    <el-alert v-else-if="fetchError" :title="fetchError" type="error" show-icon />

    <el-card v-else class="form-card">
      <el-alert v-if="error" :title="error" type="error" show-icon style="margin-bottom: 16px" />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="Name" prop="name">
          <el-input v-model="form.name" placeholder="My OpenAI Provider" />
        </el-form-item>

        <el-form-item label="API Base URL" prop="apiBaseUrl">
          <el-input v-model="form.apiBaseUrl" placeholder="https://api.openai.com/v1" />
          <div class="form-hint">The base URL for the provider's API endpoint.</div>
        </el-form-item>

        <el-form-item label="API Key" :prop="isEdit ? '' : 'apiKey'" :required="!isEdit">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="isEdit ? 'Leave blank to keep existing' : 'sk-...'"
          />
          <div v-if="isEdit" class="form-hint">Leave blank to keep the existing key.</div>
        </el-form-item>

        <el-form-item label="Adapter Type" prop="adapterType">
          <el-select v-model="form.adapterType" style="width: 100%">
            <el-option label="OpenAI" value="openai" />
            <el-option label="Anthropic" value="anthropic" />
          </el-select>
          <div class="form-hint">Select the API format this provider uses.</div>
        </el-form-item>

        <el-form-item>
          <div class="form-actions">
            <el-button @click="goBack">Cancel</el-button>
            <el-button type="primary" native-type="submit" :loading="saving">
              {{ saving ? 'Saving...' : isEdit ? 'Update Provider' : 'Create Provider' }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 600px;
}

.page-header {
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

.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}
</style>
