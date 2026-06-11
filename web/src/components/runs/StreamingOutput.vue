<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { marked } from 'marked';
import type { AgentTraceStep } from '../../types';
import AgentTrace from './AgentTrace.vue';

const props = defineProps<{
  runId: string;
  modelId: string;
  providerName: string;
  content: string;
  thinkingContent: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  latencyMs?: number | null;
  error?: string | null;
  agentTrace?: AgentTraceStep[];
  currentIteration?: number;
}>();

const { t } = useI18n();

const thinkingExpanded = ref(true);

const hasThinkingInTrace = computed(() =>
  props.agentTrace?.some(step => step.kind === 'thinking'),
);

const renderedMarkdown = computed(() => {
  if (!props.content && props.status === 'pending') {
    return `<p class="placeholder">${t('streaming.waiting')}</p>`;
  }
  if (!props.content && props.status === 'running') {
    return '';
  }
  if (!props.content) {
    return `<p class="placeholder">${t('streaming.noOutput')}</p>`;
  }
  return marked(props.content) as string;
});

const thinkingHtml = computed(() => {
  if (!props.thinkingContent) return '';
  return marked(props.thinkingContent) as string;
});

const statusTagType = computed(() => {
  switch (props.status) {
    case 'completed': return 'success';
    case 'error': return 'danger';
    case 'running': return 'primary';
    default: return 'warning';
  }
});

const statusLabel = computed(() => {
  return t(`streaming.${props.status}`);
});

const latencyLabel = computed(() => {
  if (props.latencyMs == null) return '';
  if (props.latencyMs < 1000) return `${props.latencyMs}ms`;
  return `${(props.latencyMs / 1000).toFixed(1)}s`;
});

marked.setOptions({
  breaks: true,
  gfm: true,
});
</script>

<template>
  <div class="streaming-output" :class="status">
    <el-card shadow="never" :class="['output-card', status]">
      <div class="panel-header">
        <div class="panel-title">
          <span class="provider">{{ providerName }}</span>
          <span class="sep">/</span>
          <span class="model">{{ modelId }}</span>
        </div>
        <div class="panel-meta">
          <el-tag :type="statusTagType" size="small">{{ statusLabel }}</el-tag>
          <span v-if="latencyLabel" class="latency">{{ latencyLabel }}</span>
        </div>
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon />

      <!-- Thinking/Reasoning block (only for simple mode; agentic mode shows thinking in trace) -->
      <div v-if="thinkingContent && !hasThinkingInTrace" class="thinking-section">
        <el-button
          class="thinking-toggle-btn"
          @click="thinkingExpanded = !thinkingExpanded"
        >
          <span :class="['toggle-arrow', { open: thinkingExpanded }]">&#9654;</span>
          {{ t('streaming.thinking') }}
          <span v-if="status === 'running'" class="thinking-inline-spinner"></span>
        </el-button>
        <div v-show="thinkingExpanded" class="thinking-body markdown-body" v-html="thinkingHtml"></div>
      </div>

      <!-- Agent Trace -->
      <div v-if="agentTrace && agentTrace.length > 0" class="agent-trace-section">
        <AgentTrace
          :trace="agentTrace"
          :current-iteration="currentIteration || 0"
          :live="status === 'running'"
        />
      </div>

      <div class="panel-body markdown-body" v-html="renderedMarkdown"></div>
      <div v-if="status === 'running' && (!agentTrace || agentTrace.length === 0)" class="typing-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.streaming-output {
  /* wrapper */
}

.output-card {
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.output-card :deep(.el-card__body) {
  padding: 0;
}

.output-card.running {
  border-color: var(--primary-border);
  box-shadow: 0 0 0 1px var(--primary-bg);
}

.output-card.error {
  border-color: rgba(220, 38, 38, 0.3);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--border-light);
  border-bottom: 1px solid var(--border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
}

.provider {
  color: var(--primary);
}

.sep {
  color: var(--text-muted);
}

.model {
  font-family: var(--mono);
  font-size: 12px;
}

.panel-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.latency {
  font-size: 12px;
  font-family: var(--mono);
  color: var(--text-muted);
}

/* ---- Thinking section ---- */
.thinking-section {
  border-bottom: 1px solid var(--border);
}

.thinking-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 16px;
  background: rgba(245, 158, 11, 0.06);
  border: none;
  border-radius: 0;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #b45309;
  text-align: left;
}

.thinking-toggle-btn:hover {
  background: rgba(245, 158, 11, 0.12);
}

.toggle-arrow {
  font-size: 10px;
  transition: transform 0.2s;
  display: inline-block;
}

.toggle-arrow.open {
  transform: rotate(90deg);
}

.thinking-inline-spinner {
  width: 10px;
  height: 10px;
  border: 2px solid #b45309;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-left: 4px;
}

.thinking-body {
  padding: 12px 16px;
  max-height: 300px;
  overflow-y: auto;
  background: rgba(245, 158, 11, 0.03);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
  border-top: 1px solid var(--border);
}

.panel-body {
  padding: 16px;
  min-height: 80px;
  max-height: 500px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-h);
}

.panel-body :deep(p) {
  margin: 0 0 12px;
}

.panel-body :deep(p:last-child) {
  margin-bottom: 0;
}

.panel-body :deep(pre) {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 13px;
  margin: 0 0 12px;
}

.panel-body :deep(code) {
  font-family: var(--mono);
  font-size: 13px;
  padding: 2px 6px;
  background: var(--border-light);
  border-radius: 4px;
}

.panel-body :deep(pre code) {
  padding: 0;
  background: none;
  border-radius: 0;
}

.panel-body :deep(.placeholder) {
  color: var(--text-muted);
  font-style: italic;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 16px 12px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  animation: blink 1.4s infinite both;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ---- Agent trace section ---- */
.agent-trace-section {
  border-top: 1px solid var(--border);
}
</style>
