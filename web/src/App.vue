<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();
const elLocale = ref<unknown>();

async function loadLocale(lang: string) {
  if (lang === 'zh-CN') {
    elLocale.value = (await import('element-plus/dist/locale/zh-cn.mjs')).default;
  } else {
    elLocale.value = (await import('element-plus/dist/locale/en.mjs')).default;
  }
}

loadLocale(locale.value);

watch(locale, (lang) => {
  loadLocale(lang);
});
</script>

<template>
  <el-config-provider :locale="elLocale as any">
    <router-view />
  </el-config-provider>
</template>
