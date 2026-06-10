<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ModelInfo, RunTarget } from '../../types';
import { getAllModels } from '../../api/providers';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  targets: RunTarget[];
}>();

const emit = defineEmits<{
  (e: 'update:targets', value: RunTarget[]): void;
}>();

const { t } = useI18n();

const selectedModelId = ref<string>('');
const manualModelId = ref<string>('');
const manualProviderId = ref<string>('');
const allModels = ref<ModelInfo[]>([]);
const loadingModels = ref(false);
const modelError = ref('');
const inputMode = ref<'select' | 'manual'>('select');

const modelsByProvider = computed(() => {
  const groups: Record<string, ModelInfo[]> = {};
  for (const m of allModels.value) {
    if (!groups[m.providerId]) groups[m.providerId] = [];
    groups[m.providerId].push(m);
  }
  return groups;
});

const providers = computed(() => {
  return allModels.value
    .map(m => m.provider)
    .filter((p, i, arr) => p && arr.findIndex(x => x?.id === p.id) === i) as NonNullable<ModelInfo['provider']>[];
});

async function loadModels() {
  loadingModels.value = true;
  modelError.value = '';
  try {
    allModels.value = await getAllModels();
  } catch (err) {
    modelError.value = err instanceof Error ? err.message : 'Failed to load models';
  } finally {
    loadingModels.value = false;
  }
}

function addTarget() {
  let providerId = '';
  let providerName = '';
  let modelId = '';

  if (inputMode.value === 'manual') {
    providerId = manualProviderId.value;
    const provider = providers.value.find(p => p.id === providerId);
    if (!provider || !manualModelId.value.trim()) return;
    providerName = provider.name;
    modelId = manualModelId.value.trim();
  } else {
    if (!selectedModelId.value) return;
    const model = allModels.value.find(m => m.id === selectedModelId.value);
    if (!model || !model.provider) return;
    providerId = model.providerId;
    providerName = model.provider.name;
    modelId = model.modelId;
  }

  if (props.targets.some(t => t.providerId === providerId && t.modelId === modelId)) {
    ElMessage.warning(t('modelSelector.alreadySelected'));
    return;
  }

  const newTarget: RunTarget = { providerId, providerName, modelId };
  emit('update:targets', [...props.targets, newTarget]);
  selectedModelId.value = '';
  manualModelId.value = '';
}

function removeTarget(idx: number) {
  const next = props.targets.slice();
  next.splice(idx, 1);
  emit('update:targets', next);
}

onMounted(loadModels);
</script>

<template>
  <div class="model-selector">
    <div v-if="loadingModels" class="loading-banner">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      {{ t('modelSelector.loadingModels') }}
    </div>

    <el-alert v-if="modelError" :title="modelError" type="error" show-icon>
      <template #default>
        <el-button size="small" @click="loadModels">{{ t('common.retry') }}</el-button>
      </template>
    </el-alert>

    <el-alert
      v-if="!loadingModels && allModels.length === 0 && !modelError"
      :title="t('modelSelector.noModelsCached')"
      type="info"
      show-icon
    />

    <el-radio-group v-if="allModels.length > 0" v-model="inputMode" class="mode-toggle">
      <el-radio-button value="select">{{ t('modelSelector.selectCached') }}</el-radio-button>
      <el-radio-button value="manual">{{ t('modelSelector.manualInput') }}</el-radio-button>
    </el-radio-group>

    <div v-if="inputMode === 'select' && allModels.length > 0" class="add-row">
      <el-select
        v-model="selectedModelId"
        :placeholder="t('modelSelector.selectPlaceholder')"
        style="flex: 1"
        filterable
      >
        <el-option-group
          v-for="(models, providerId) in modelsByProvider"
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
      <el-button
        type="primary"
        :disabled="!selectedModelId"
        @click="addTarget"
      >{{ t('modelSelector.addTarget') }}</el-button>
    </div>

    <div v-if="inputMode === 'manual' && providers.length > 0" class="manual-input">
      <div class="add-row">
        <el-select v-model="manualProviderId" :placeholder="t('modelSelector.selectProviderPlaceholder')" style="flex: 1">
          <el-option
            v-for="p in providers"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
        <div style="width: 110px"></div>
      </div>
      <div class="add-row">
        <el-input
          v-model="manualModelId"
          :placeholder="t('modelSelector.modelIdPlaceholder')"
          :disabled="!manualProviderId"
          style="flex: 1"
        />
        <el-button
          type="primary"
          :disabled="!manualProviderId || !manualModelId.trim()"
          @click="addTarget"
        >{{ t('modelSelector.addTarget') }}</el-button>
      </div>
    </div>

    <div v-if="targets.length > 0" class="targets">
      <label>{{ t('modelSelector.selectedTargets') }} ({{ targets.length }})</label>
      <div class="chips">
        <el-tag
          v-for="(t, i) in targets"
          :key="`${t.providerId}-${t.modelId}`"
          closable
          class="chip-tag"
          @close="removeTarget(i)"
        >
          <span class="chip-provider">{{ t.providerName }}</span>
          <span class="chip-sep">/</span>
          <span class="chip-model">{{ t.modelId }}</span>
        </el-tag>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.manual-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
}

.mode-toggle {
  margin-bottom: 4px;
}

.targets {
  margin-top: 8px;
}

.targets label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
  margin-bottom: 6px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-tag {
  font-size: 12px;
}

.chip-provider {
  font-weight: 600;
}

.chip-sep {
  opacity: 0.5;
  margin: 0 4px;
}

.chip-model {
  font-family: var(--mono);
}
</style>
