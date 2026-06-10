<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft } from '@element-plus/icons-vue';
import type { CreateProviderInput } from '../types';
import { createProvider, getProvider, updateProvider } from '../api/providers';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

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
      <el-button :icon="ArrowLeft" @click="goBack" text>{{ t('common.back') }}</el-button>
      <h1>{{ isEdit ? t('providers.updateProvider') : t('providers.createProvider') }}</h1>
    </div>

    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      <span>{{ t('common.loading') }}</span>
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
        <el-form-item :label="t('providers.name')" prop="name">
          <el-input v-model="form.name" :placeholder="t('providers.namePlaceholder')" />
        </el-form-item>

        <el-form-item :label="t('providers.apiBaseUrl')" prop="apiBaseUrl">
          <el-input v-model="form.apiBaseUrl" :placeholder="t('providers.apiBaseUrlPlaceholder')" />
          <div class="form-hint">{{ t('providers.apiBaseUrlHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('providers.apiKey')" :prop="isEdit ? '' : 'apiKey'" :required="!isEdit">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="isEdit ? t('providers.apiKeyPlaceholderEdit') : t('providers.apiKeyPlaceholder')"
          />
          <div v-if="isEdit" class="form-hint">{{ t('providers.apiKeyHintEdit') }}</div>
        </el-form-item>

        <el-form-item :label="t('providers.adapterType')" prop="adapterType">
          <el-select v-model="form.adapterType" style="width: 100%">
            <el-option label="OpenAI" value="openai" />
            <el-option label="Anthropic" value="anthropic" />
          </el-select>
          <div class="form-hint">{{ t('providers.adapterTypeHint') }}</div>
        </el-form-item>

        <el-form-item>
          <div class="form-actions">
            <el-button @click="goBack">{{ t('common.cancel') }}</el-button>
            <el-button type="primary" native-type="submit" :loading="saving">
              {{ saving ? t('providers.saving') : isEdit ? t('providers.updateProvider') : t('providers.createProvider') }}
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
