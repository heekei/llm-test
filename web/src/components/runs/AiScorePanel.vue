<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AiScoreResult, AiScoreItem } from '../../types';

const props = defineProps<{
  aiScores: AiScoreResult;
}>();

const { t } = useI18n();

const dimensionLabels: Record<string, string> = {
  accuracy: 'aiScore.accuracy',
  completeness: 'aiScore.completeness',
  coherence: 'aiScore.coherence',
  creativity: 'aiScore.creativity',
  instructionFollowing: 'aiScore.instructionFollowing',
};

const dimensionOrder = ['accuracy', 'completeness', 'coherence', 'creativity', 'instructionFollowing'];

const orderedScores = computed(() => {
  const map = new Map(props.aiScores.scores.map((s) => [s.dimension, s]));
  return dimensionOrder
    .map((dim) => map.get(dim))
    .filter((s): s is AiScoreItem => !!s);
});

const weightedTotal = computed(() => {
  let total = 0;
  for (const s of props.aiScores.scores) {
    total += s.score * s.weight;
  }
  return total.toFixed(1);
});

const maxWeightedTotal = computed(() => {
  let total = 0;
  for (const s of props.aiScores.scores) {
    total += s.maxScore * s.weight;
  }
  return total.toFixed(1);
});

function barWidth(score: number, maxScore: number): string {
  return `${(score / maxScore) * 100}%`;
}

function barColor(score: number, maxScore: number): string {
  const ratio = score / maxScore;
  if (ratio >= 0.8) return '#059669';
  if (ratio >= 0.6) return '#d97706';
  return '#dc2626';
}
</script>

<template>
  <div class="ai-score-panel">
    <div class="score-header">
      <span class="score-badge">{{ t('aiScore.title') }} {{ weightedTotal }} / {{ maxWeightedTotal }}</span>
    </div>

    <div class="score-bars">
      <div v-for="s in orderedScores" :key="s.dimension" class="score-row">
        <div class="score-label">
          <span class="dim-name">{{ $t(dimensionLabels[s.dimension]) || s.dimension }}</span>
          <span class="dim-score">{{ s.score }}/{{ s.maxScore }}</span>
        </div>
        <div class="bar-track">
          <div
            class="bar-fill"
            :style="{
              width: barWidth(s.score, s.maxScore),
              backgroundColor: barColor(s.score, s.maxScore),
            }"
          />
        </div>
        <p class="reasoning">{{ s.reasoning }}</p>
      </div>
    </div>

    <p v-if="aiScores.overall" class="overall">{{ aiScores.overall }}</p>
  </div>
</template>

<style scoped>
.ai-score-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.score-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: var(--primary-bg);
  color: var(--primary);
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
}

.score-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.score-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.score-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.dim-name {
  font-weight: 500;
  color: var(--text-h);
}

.dim-score {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
}

.bar-track {
  height: 8px;
  background: var(--border-light);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.reasoning {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

.overall {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--border-light);
}
</style>
