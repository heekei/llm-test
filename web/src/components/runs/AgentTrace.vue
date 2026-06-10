<script setup lang="ts">
import { computed } from 'vue';
import type { AgentTraceStep } from '../../types';
import { Document, Tools, Finished, CircleCheck, CircleClose } from '@element-plus/icons-vue';

const props = defineProps<{
  trace: AgentTraceStep[];
  currentIteration?: number;
  live?: boolean; // true during active streaming
}>();

/** Group trace steps by iteration */
const iterations = computed(() => {
  const groups: { iter: number; steps: AgentTraceStep[] }[] = [];
  let current: AgentTraceStep[] = [];
  let currentIter = 1;
  for (const step of props.trace) {
    if (step.iteration !== currentIter && current.length > 0) {
      groups.push({ iter: currentIter, steps: current });
      current = [];
    }
    currentIter = step.iteration;
    current.push(step);
  }
  if (current.length > 0) {
    groups.push({ iter: currentIter, steps: current });
  }
  return groups;
});

function truncate(str: string, n: number): string {
  if (!str) return '';
  if (str.length <= n) return str;
  return str.slice(0, n) + '...';
}

function formatInput(input: object | undefined): string {
  if (!input) return '';
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}
</script>

<template>
  <div class="agent-trace">
    <div v-if="trace.length === 0 && live" class="trace-waiting">
      <el-icon class="is-loading"><i class="el-icon-loading" /></el-icon>
      <span>Agent is thinking...</span>
    </div>

    <div v-for="group in iterations" :key="group.iter" class="iteration-group">
      <div class="iteration-header">
        <span class="iteration-num">#{{ group.iter }}</span>
        <el-tag v-if="live && group.iter === (currentIteration || 1)" type="primary" size="small" effect="dark">
          In progress
        </el-tag>
      </div>

      <div class="trace-steps">
        <div
          v-for="(step, i) in group.steps"
          :key="i"
          :class="['trace-step', step.kind]"
        >
          <!-- LLM Text -->
          <template v-if="step.kind === 'llm_text'">
            <div class="step-icon text-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="step-body">
              <div class="step-label">Response</div>
              <div class="step-content text-content">{{ truncate(step.content, 500) }}</div>
            </div>
          </template>

          <!-- Tool Call -->
          <template v-else-if="step.kind === 'tool_call'">
            <div class="step-icon call-icon">
              <el-icon><Tools /></el-icon>
            </div>
            <div class="step-body">
              <div class="step-label">
                Tool: <strong>{{ step.toolName }}</strong>
                <span v-if="step.toolCallId" class="tool-id">{{ step.toolCallId?.slice(0, 8) }}...</span>
              </div>
              <details v-if="step.toolInput && Object.keys(step.toolInput).length > 0" class="tool-input">
                <summary>Input</summary>
                <pre>{{ formatInput(step.toolInput) }}</pre>
              </details>
              <details :open="step.isError" class="tool-output">
                <summary>{{ step.isError ? '✕ Error' : '✓ Result' }}</summary>
                <pre :class="{ 'output-error': step.isError }">{{ step.content }}</pre>
              </details>
            </div>
          </template>

          <!-- Tool Result (when separate) -->
          <template v-else-if="step.kind === 'tool_result'">
            <div class="step-icon" :class="step.isError ? 'error-icon' : 'result-icon'">
              <el-icon v-if="step.isError"><CircleClose /></el-icon>
              <el-icon v-else><CircleCheck /></el-icon>
            </div>
            <div class="step-body">
              <div class="step-label">
                {{ step.isError ? 'Error' : 'Result' }}
                <span v-if="step.toolCallId" class="tool-id">{{ step.toolCallId?.slice(0, 8) }}...</span>
              </div>
              <div :class="['step-content', { 'error-content': step.isError }]">
                {{ truncate(step.content, 500) }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="live && trace.length > 0" class="trace-active-dot">
      <span class="dot-pulse"></span>
      Working...
    </div>
  </div>
</template>

<style scoped>
.agent-trace {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trace-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 13px;
  color: var(--text-muted);
}

.iteration-group {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.iteration-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--border-light);
  border-bottom: 1px solid var(--border);
}

.iteration-num {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-h);
  font-family: var(--mono);
}

.trace-steps {
  display: flex;
  flex-direction: column;
}

.trace-step {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-light);
}

.trace-step:last-child {
  border-bottom: none;
}

.step-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.text-icon { background: var(--primary-bg); color: var(--primary); }
.call-icon { background: rgba(217, 119, 6, 0.1); color: var(--warning); }
.result-icon { background: var(--success-bg); color: var(--success); }
.error-icon { background: var(--error-bg); color: var(--error); }

.step-body {
  flex: 1;
  min-width: 0;
}

.step-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: 4px;
}

.step-label strong {
  color: var(--text-h);
}

.tool-id {
  font-family: var(--mono);
  font-weight: 400;
  margin-left: 6px;
  opacity: 0.6;
}

.step-content {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-h);
}

.text-content {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.error-content {
  color: var(--error);
}

.tool-input, .tool-output {
  margin-top: 6px;
}

.tool-input summary, .tool-output summary {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
}

.tool-input pre, .tool-output pre {
  margin: 4px 0 0;
  padding: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 150px;
  overflow-y: auto;
}

.output-error {
  color: var(--error);
  border-color: rgba(220, 38, 38, 0.3) !important;
  background: var(--error-bg) !important;
}

.trace-active-dot {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 0;
}

.dot-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
</style>
