import { createI18n } from 'vue-i18n';
import en from './en';
import zhCN from './zh-CN';

const saved = localStorage.getItem('lang') || 'en';

const i18n = createI18n({
  legacy: false,
  locale: saved,
  fallbackLocale: 'en',
  messages: { en, 'zh-CN': zhCN },
});

export default i18n;
