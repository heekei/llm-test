<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

function toggle() {
  locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN';
  localStorage.setItem('lang', locale.value);
}
</script>

<template>
  <el-button text size="small" class="lang-switch" @click="toggle">
    {{ locale === 'zh-CN' ? 'English' : '中文' }}
  </el-button>
</template>

<style scoped>
.lang-switch {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
