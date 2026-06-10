import { createRouter, createWebHistory } from 'vue-router';
import AppLayout from '../components/layout/AppLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          redirect: '/tasks',
        },
        {
          path: 'providers',
          name: 'providers',
          component: () => import('../views/ProvidersView.vue'),
        },
        {
          path: 'providers/new',
          name: 'provider-new',
          component: () => import('../views/ProviderFormView.vue'),
        },
        {
          path: 'providers/:id/edit',
          name: 'provider-edit',
          component: () => import('../views/ProviderFormView.vue'),
          props: true,
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('../views/TasksView.vue'),
        },
        {
          path: 'tasks/new',
          name: 'task-new',
          component: () => import('../views/TaskCreateView.vue'),
        },
        {
          path: 'tasks/:id',
          name: 'task-detail',
          component: () => import('../views/TaskDetailView.vue'),
          props: true,
        },
        {
          path: 'history',
          name: 'history',
          component: () => import('../views/HistoryView.vue'),
        },
        {
          path: 'compare/:taskId',
          name: 'compare',
          component: () => import('../views/CompareView.vue'),
          props: true,
        },
      ],
    },
  ],
});

export default router;
