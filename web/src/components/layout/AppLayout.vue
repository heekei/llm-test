<script setup lang="ts">
import { RouterView } from 'vue-router';
import { Monitor, Collection, Clock } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import LangSwitch from './LangSwitch.vue';

const { t } = useI18n();
</script>

<template>
  <div class="app-shell">
    <el-container class="app-container">
      <el-aside width="220px" class="app-sidebar">
        <div class="brand">
          <div class="brand-icon">LLM</div>
          <div class="brand-text">Test Platform</div>
        </div>
        <el-menu
          :default-active="$route.path"
          router
          class="nav-menu"
          background-color="transparent"
        >
          <el-menu-item index="/tasks">
            <el-icon><Collection /></el-icon>
            <span>{{ t('nav.tasks') }}</span>
          </el-menu-item>
          <el-menu-item index="/providers">
            <el-icon><Monitor /></el-icon>
            <span>{{ t('nav.providers') }}</span>
          </el-menu-item>
          <el-menu-item index="/history">
            <el-icon><Clock /></el-icon>
            <span>{{ t('nav.history') }}</span>
          </el-menu-item>
        </el-menu>
        <div class="sidebar-footer">
          <LangSwitch />
          <div class="version">{{ t('version') }}</div>
        </div>
      </el-aside>
      <el-container>
        <el-header height="56px" class="app-header">
          <span class="header-title">{{ t('header.title') }}</span>
          <span class="header-sub">{{ t('header.subtitle') }}</span>
        </el-header>
        <el-main class="app-content">
          <RouterView />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-container {
  min-height: 100vh;
}

.app-sidebar {
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px 20px;
  border-bottom: 1px solid var(--border-light);
}

.brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.brand-text {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-h);
}

.nav-menu {
  border-right: none !important;
  flex: 1;
  padding: 8px;
}

.nav-menu :deep(.el-menu-item) {
  border-radius: var(--radius);
  margin-bottom: 2px;
  height: 40px;
  line-height: 40px;
}

.nav-menu :deep(.el-menu-item.is-active) {
  background: var(--primary-bg);
  color: var(--primary);
}

.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.version {
  font-size: 12px;
  color: var(--text-muted);
}

.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  --el-header-padding: 0 32px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}

.header-sub {
  font-size: 13px;
  color: var(--text-muted);
}

.app-content {
  background: var(--bg);
  padding: 28px 32px;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .app-sidebar {
    width: 60px !important;
  }
  .brand-text,
  .nav-menu :deep(.el-menu-item span),
  .version {
    display: none;
  }
  .nav-menu :deep(.el-menu-item) {
    justify-content: center;
    padding: 0 !important;
  }
  .app-content {
    padding: 20px 16px;
  }
  .app-header {
    --el-header-padding: 0 16px;
  }
}
</style>
