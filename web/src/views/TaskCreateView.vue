<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft, Upload } from '@element-plus/icons-vue';
import type { RunTarget, CreateTaskInput, UploadAttachmentResponse } from '../types';
import type { TaskTemplate } from '../data/templates';
import { createTask, uploadAttachment } from '../api/tasks';
import ModelSelector from '../components/tasks/ModelSelector.vue';
import TemplateSelector from '../components/tasks/TemplateSelector.vue';
import { ElMessage } from 'element-plus';

const router = useRouter();
const { t } = useI18n();

const form = reactive<CreateTaskInput>({
  title: '',
  description: '',
  systemPrompt: '',
  prompt: '',
  temperature: 0.7,
  maxTokens: 4096,
  thinkingBudgetTokens: undefined,
  reasoningEffort: undefined,
  mode: 'simple',
  tools: [],
  maxIterations: undefined,
  agentTimeoutSec: undefined,
  dockerImage: undefined,
});

const targets = ref<RunTarget[]>([]);
const saving = ref(false);
const error = ref('');

// Attachment state
const attachingFile = ref(false);
const attachedFiles = ref<UploadAttachmentResponse[]>([]);
const uploadRef = ref<any>(null);

function applyTemplate(template: TaskTemplate) {
  form.title = template.title;
  form.description = template.description;
  form.prompt = template.prompt;
  if (template.systemPrompt) form.systemPrompt = template.systemPrompt;
  if (template.temperature !== undefined) form.temperature = template.temperature;
  if (template.maxTokens !== undefined) form.maxTokens = template.maxTokens;
  if (template.thinkingBudgetTokens !== undefined) form.thinkingBudgetTokens = template.thinkingBudgetTokens;
  if (template.reasoningEffort !== undefined) form.reasoningEffort = template.reasoningEffort;
  if (template.mode !== undefined) form.mode = template.mode;
  if (template.tools !== undefined) form.tools = template.tools;
  if (template.maxIterations !== undefined) form.maxIterations = template.maxIterations;
  if (template.agentTimeoutSec !== undefined) form.agentTimeoutSec = template.agentTimeoutSec;
}

async function handleSubmit() {
  error.value = '';
  if (!form.title.trim()) {
    ElMessage.warning(t('tasks.titleRequired'));
    return;
  }
  if (!form.prompt.trim()) {
    ElMessage.warning(t('tasks.promptRequired'));
    return;
  }
  saving.value = true;
  try {
    const payload: CreateTaskInput = {
      title: form.title.trim(),
      prompt: form.prompt.trim(),
    };
    if (attachedFiles.value.length > 0) {
      payload.attachmentFiles = attachedFiles.value.map((f) => ({
        filename: f.filename,
        originalName: f.originalName,
        mimeType: f.mimeType,
      }));
    }
    if (form.description?.trim()) payload.description = form.description.trim();
    if (form.systemPrompt?.trim()) payload.systemPrompt = form.systemPrompt.trim();
    if (form.temperature !== 0.7) payload.temperature = form.temperature;
    if (form.maxTokens !== 4096) payload.maxTokens = form.maxTokens;
    if (form.thinkingBudgetTokens) payload.thinkingBudgetTokens = form.thinkingBudgetTokens;
    if (form.reasoningEffort) payload.reasoningEffort = form.reasoningEffort;
    if (form.mode) payload.mode = form.mode;
    if (form.tools && form.tools.length > 0) payload.tools = form.tools;
    if (form.maxIterations) payload.maxIterations = form.maxIterations;
    if (form.agentTimeoutSec) payload.agentTimeoutSec = form.agentTimeoutSec;
    if (form.dockerImage) payload.dockerImage = form.dockerImage;
    if (targets.value.length > 0) payload.defaultTargets = targets.value;

    const task = await createTask(payload);
    router.push({ name: 'task-detail', params: { id: task.id } });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create task';
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push({ name: 'tasks' });
}

async function handleUploadChange(file: any) {
  if (!file?.raw) return;
  attachingFile.value = true;
  try {
    const res = await uploadAttachment(file.raw);
    attachedFiles.value = [...attachedFiles.value, res];
    ElMessage.success(t('tasks.uploadSuccess', { name: res.originalName }));
  } catch (err) {
    ElMessage.error(t('tasks.uploadFailed', { name: (file as any)?.name || 'file' }));
  } finally {
    attachingFile.value = false;
    // Clear el-upload internal state
    uploadRef.value?.clearFiles?.();
  }
}

function removeAttachment(idx: number) {
  attachedFiles.value.splice(idx, 1);
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <el-button :icon="ArrowLeft" @click="goBack" text>{{ t('common.back') }}</el-button>
        <h1>{{ t('tasks.createTask') }}</h1>
      </div>
      <TemplateSelector @select="applyTemplate" />
    </div>

    <el-card class="form-card">
      <el-alert v-if="error" :title="error" type="error" show-icon style="margin-bottom: 16px" />

      <el-form label-position="top" @submit.prevent="handleSubmit">
        <el-form-item :label="t('tasks.title')" required>
          <el-input v-model="form.title" :placeholder="t('tasks.titlePlaceholder')" />
        </el-form-item>

        <el-form-item :label="t('tasks.description')">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            :placeholder="t('tasks.descriptionPlaceholder')"
          />
        </el-form-item>

        <el-form-item :label="t('tasks.systemPrompt')">
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="3"
            :placeholder="t('tasks.systemPromptPlaceholder')"
          />
          <div class="form-hint">{{ t('tasks.systemPromptHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('tasks.promptLabel')" required>
          <!-- Attachments -->
          <div v-if="attachedFiles.length > 0" class="attachment-list">
            <el-tag
              v-for="(f, i) in attachedFiles"
              :key="i"
              closable
              class="attachment-tag"
              @close="removeAttachment(i)"
            >
              {{ f.originalName }}
            </el-tag>
          </div>
          <div class="upload-row">
            <el-upload
              ref="uploadRef"
              :show-file-list="false"
              :auto-upload="false"
              :on-change="handleUploadChange"
              :disabled="attachingFile"
            >
              <el-button size="small" :icon="Upload" :loading="attachingFile">
                {{ attachingFile ? t('tasks.uploading') : t('tasks.uploadButton') }}
              </el-button>
            </el-upload>
            <span class="form-hint" style="margin-top:0;line-height:32px">{{ t('tasks.uploadHint') }}</span>
          </div>
          <el-input
            v-model="form.prompt"
            type="textarea"
            :rows="5"
            :placeholder="t('tasks.promptPlaceholder')"
          />
          <div class="form-hint">{{ t('tasks.promptHint') }}</div>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('tasks.temperature')">
              <el-input-number
                v-model="form.temperature"
                :min="0"
                :max="2"
                :step="0.1"
                :precision="1"
                style="width: 100%"
              />
              <div class="form-hint">{{ t('tasks.temperatureHint') }}</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('tasks.maxTokens')">
              <el-input-number
                v-model="form.maxTokens"
                :min="1"
                :max="128000"
                style="width: 100%"
              />
              <div class="form-hint">{{ t('tasks.maxTokensHint') }}</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="t('tasks.thinkingBudgetTokens')">
          <el-input-number
            v-model="form.thinkingBudgetTokens"
            :min="1024"
            :placeholder="t('tasks.thinkingBudgetTokensPlaceholder')"
            style="width: 100%"
          />
          <div class="form-hint">{{ t('tasks.thinkingBudgetTokensHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('tasks.reasoningEffort')">
          <el-select v-model="form.reasoningEffort" style="width: 100%" clearable :placeholder="t('tasks.reasoningEffortPlaceholder')">
            <el-option label="Low" value="low" />
            <el-option label="Medium" value="medium" />
            <el-option label="High" value="high" />
          </el-select>
          <div class="form-hint">{{ t('tasks.reasoningEffortHint') }}</div>
        </el-form-item>

        <el-divider />
        <h3>{{ t('tasks.agenticMode') }}</h3>
        <p class="section-desc">{{ t('tasks.agenticModeDesc') }}</p>

        <el-form-item :label="t('tasks.mode')">
          <el-switch
            v-model="form.mode"
            active-value="agentic"
            inactive-value="simple"
            :active-text="t('tasks.modeAgentic')"
            :inactive-text="t('tasks.modeSimple')"
          />
          <div class="form-hint">{{ t('tasks.modeHint') }}</div>
        </el-form-item>

        <template v-if="form.mode === 'agentic'">
          <el-form-item :label="t('tasks.enabledTools')">
            <el-checkbox-group v-model="form.tools">
              <el-checkbox label="bash">Bash</el-checkbox>
              <el-checkbox label="python">Python</el-checkbox>
              <el-checkbox label="read_file">Read File</el-checkbox>
              <el-checkbox label="write_file">Write File</el-checkbox>
              <el-checkbox label="web_request">Web Request</el-checkbox>
            </el-checkbox-group>
            <div class="form-hint">{{ t('tasks.toolsHint') }}</div>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item :label="t('tasks.maxIterations')">
                <el-input-number v-model="form.maxIterations" :min="1" :max="100" style="width: 100%" />
                <div class="form-hint">{{ t('tasks.maxIterationsHint') }}</div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="t('tasks.timeout')">
                <el-input-number v-model="form.agentTimeoutSec" :min="10" :max="3600" style="width: 100%" />
                <div class="form-hint">{{ t('tasks.timeoutHint') }}</div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item :label="t('tasks.dockerImage')">
            <el-input v-model="form.dockerImage" :placeholder="t('tasks.dockerImagePlaceholder')" />
            <div class="form-hint">{{ t('tasks.dockerImageHint') }}</div>
          </el-form-item>
        </template>

        <el-divider />
        <h3>{{ t('tasks.modelTargets') }}</h3>
        <p class="section-desc">{{ t('tasks.modelTargetsDesc') }}</p>

        <ModelSelector v-model:targets="targets" />

        <el-divider />
        <div class="form-actions">
          <el-button @click="goBack">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" native-type="submit" :loading="saving">
            {{ saving ? t('tasks.creating') : t('tasks.createTask') }}
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 700px;
}

.page-header > div {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-header h1 {
  margin: 0;
}

.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.section-desc {
  color: var(--text-muted);
  font-size: 13px;
  margin: 4px 0 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.attachment-tag {
  font-size: 12px;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
</style>
