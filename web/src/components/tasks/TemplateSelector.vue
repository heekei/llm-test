<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TASK_TEMPLATES, type TaskTemplate } from '../../data/templates';

const emit = defineEmits<{
  (e: 'select', template: TaskTemplate): void;
}>();

const { t } = useI18n();

const showDialog = ref(false);
const selectedCategory = ref<string>('all');

const categories = [
  { value: 'all', labelKey: 'categories.all' },
  { value: 'reasoning', labelKey: 'categories.reasoning' },
  { value: 'coding', labelKey: 'categories.coding' },
  { value: 'agentic', labelKey: 'categories.agentic' },
  { value: 'creative', labelKey: 'categories.creative' },
  { value: 'knowledge', labelKey: 'categories.knowledge' },
  { value: 'instruction', labelKey: 'categories.instruction' },
  { value: 'safety', labelKey: 'categories.safety' },
];

const filteredTemplates = computed(() => {
  if (selectedCategory.value === 'all') {
    return TASK_TEMPLATES;
  }
  return TASK_TEMPLATES.filter(t => t.category === selectedCategory.value);
});

function openDialog() {
  showDialog.value = true;
}

function closeDialog() {
  showDialog.value = false;
}

function selectTemplate(template: TaskTemplate) {
  emit('select', template);
  closeDialog();
}

defineExpose({ openDialog });
</script>

<template>
  <div>
    <el-button @click="openDialog">
      {{ t('tasks.templateButton') }}
    </el-button>

    <el-dialog
      v-model="showDialog"
      :title="t('tasks.templateDialogTitle')"
      width="900px"
      :close-on-click-modal="false"
      @close="closeDialog"
    >
      <template #header>
        <h2>{{ t('tasks.templateDialogTitle') }}</h2>
      </template>

      <div class="category-filter">
        <el-button
          v-for="cat in categories"
          :key="cat.value"
          :type="selectedCategory === cat.value ? 'primary' : 'default'"
          size="small"
          round
          @click="selectedCategory = cat.value"
        >
          {{ t(cat.labelKey) }}
        </el-button>
      </div>

      <div class="templates-grid">
        <el-card
          v-for="template in filteredTemplates"
          :key="template.title"
          class="template-card"
          shadow="hover"
          @click="selectTemplate(template)"
        >
          <div class="template-header">
            <h3>{{ template.title }}</h3>
            <div class="template-tags">
              <el-tag v-if="template.mode === 'agentic'" size="small" type="danger" effect="dark">Agent</el-tag>
              <el-tag size="small" :type="template.category === 'reasoning' ? 'primary' : template.category === 'coding' ? '' : template.category === 'agentic' ? 'danger' : template.category === 'creative' ? 'warning' : template.category === 'knowledge' ? 'success' : template.category === 'safety' ? 'danger' : 'info'">
                {{ t(`categories.${template.category}`) }}
              </el-tag>
            </div>
          </div>
          <p class="template-desc">{{ template.description }}</p>
          <div class="template-preview">
            {{ template.prompt.slice(0, 120) }}{{ template.prompt.length > 120 ? '...' : '' }}
          </div>
        </el-card>
      </div>

      <template #footer>
        <el-button @click="closeDialog">{{ t('tasks.templateCancel') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.category-filter {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.template-card {
  cursor: pointer;
  transition: all 0.2s;
}

.template-card:hover {
  transform: translateY(-2px);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.template-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.template-header h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
  flex: 1;
}

.template-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 8px 0;
  line-height: 1.5;
}

.template-preview {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-top: 12px;
  padding: 8px;
  border-top: 1px solid var(--border);
  font-family: var(--mono);
  background: var(--border-light);
  border-radius: 4px;
}

h2 {
  margin: 0;
}

@media (max-width: 768px) {
  .templates-grid {
    grid-template-columns: 1fr;
  }
}
</style>
