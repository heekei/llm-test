<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from '@element-plus/icons-vue';
import type { RunTarget, CreateTaskInput } from '../types';
import type { TaskTemplate } from '../data/templates';
import { createTask } from '../api/tasks';
import ModelSelector from '../components/tasks/ModelSelector.vue';
import TemplateSelector from '../components/tasks/TemplateSelector.vue';
import { ElMessage } from 'element-plus';

const router = useRouter();

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
    ElMessage.warning('Title is required.');
    return;
  }
  if (!form.prompt.trim()) {
    ElMessage.warning('Prompt is required.');
    return;
  }
  saving.value = true;
  try {
    const payload: CreateTaskInput = {
      title: form.title.trim(),
      prompt: form.prompt.trim(),
    };
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
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <el-button :icon="ArrowLeft" @click="goBack" text>Back</el-button>
        <h1>Create Task</h1>
      </div>
      <TemplateSelector @select="applyTemplate" />
    </div>

    <el-card class="form-card">
      <el-alert v-if="error" :title="error" type="error" show-icon style="margin-bottom: 16px" />

      <el-form label-position="top" @submit.prevent="handleSubmit">
        <el-form-item label="Title" required>
          <el-input v-model="form.title" placeholder="Evaluate math reasoning" />
        </el-form-item>

        <el-form-item label="Description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="Optional description of what this task evaluates..."
          />
        </el-form-item>

        <el-form-item label="System Prompt">
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="3"
            placeholder="Optional system instructions for the model"
          />
          <div class="form-hint">Optional system instructions for the model.</div>
        </el-form-item>

        <el-form-item label="Prompt" required>
          <el-input
            v-model="form.prompt"
            type="textarea"
            :rows="5"
            placeholder="The user prompt to evaluate"
          />
          <div class="form-hint">The user prompt to evaluate.</div>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="Temperature">
              <el-input-number
                v-model="form.temperature"
                :min="0"
                :max="2"
                :step="0.1"
                :precision="1"
                style="width: 100%"
              />
              <div class="form-hint">0 - 2, default 0.7</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Max Tokens">
              <el-input-number
                v-model="form.maxTokens"
                :min="1"
                :max="128000"
                style="width: 100%"
              />
              <div class="form-hint">Default 4096</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="Thinking Budget Tokens (Anthropic)">
          <el-input-number
            v-model="form.thinkingBudgetTokens"
            :min="1024"
            placeholder="Min 1024, leave empty to disable"
            style="width: 100%"
          />
          <div class="form-hint">Enable Claude extended thinking. Must be ≥ 1024 and less than max tokens.</div>
        </el-form-item>

        <el-form-item label="Reasoning Effort (OpenAI o-series)">
          <el-select v-model="form.reasoningEffort" style="width: 100%" clearable placeholder="Off">
            <el-option label="Low" value="low" />
            <el-option label="Medium" value="medium" />
            <el-option label="High" value="high" />
          </el-select>
          <div class="form-hint">Controls reasoning depth for o1/o3/o4-mini models. Only useful with reasoning models.</div>
        </el-form-item>

        <el-divider />
        <h3>Agentic Mode</h3>
        <p class="section-desc">Let the LLM use tools (bash, Python, file I/O, web) inside a Docker sandbox with a ReAct loop.</p>

        <el-form-item label="Mode">
          <el-switch
            v-model="form.mode"
            active-value="agentic"
            inactive-value="simple"
            active-text="Agentic"
            inactive-text="Simple"
          />
          <div class="form-hint">Simple: one-shot prompt → response. Agentic: multi-turn tool-using agent.</div>
        </el-form-item>

        <template v-if="form.mode === 'agentic'">
          <el-form-item label="Enabled Tools">
            <el-checkbox-group v-model="form.tools">
              <el-checkbox label="bash">Bash</el-checkbox>
              <el-checkbox label="python">Python</el-checkbox>
              <el-checkbox label="read_file">Read File</el-checkbox>
              <el-checkbox label="write_file">Write File</el-checkbox>
              <el-checkbox label="web_request">Web Request</el-checkbox>
            </el-checkbox-group>
            <div class="form-hint">Select which tools the agent can use. Leave empty for all defaults.</div>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="Max Iterations">
                <el-input-number v-model="form.maxIterations" :min="1" :max="100" style="width: 100%" />
                <div class="form-hint">Limit ReAct loop iterations (default 20)</div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Timeout (seconds)">
                <el-input-number v-model="form.agentTimeoutSec" :min="10" :max="3600" style="width: 100%" />
                <div class="form-hint">Total agent run timeout (default 300s)</div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="Docker Image">
            <el-input v-model="form.dockerImage" placeholder="agent-sandbox:latest (leave blank for default)" />
            <div class="form-hint">Override the sandbox Docker image. Must be available on the Docker host.</div>
          </el-form-item>
        </template>

        <el-divider />
        <h3>Model Targets (optional)</h3>
        <p class="section-desc">Select models now, or add them later on the task detail page.</p>

        <ModelSelector v-model:targets="targets" />

        <el-divider />
        <div class="form-actions">
          <el-button @click="goBack">Cancel</el-button>
          <el-button type="primary" native-type="submit" :loading="saving">
            {{ saving ? 'Creating...' : 'Create Task' }}
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
</style>
