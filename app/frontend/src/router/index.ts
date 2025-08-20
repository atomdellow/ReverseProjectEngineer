import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import Analyze from '@/views/Analyze.vue'
import Preview from '@/views/Preview.vue'
import Apply from '@/views/Apply.vue'
import Settings from '@/views/Settings.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard
    },
    {
      path: '/analyze',
      name: 'analyze',
      component: Analyze
    },
    {
      path: '/preview',
      name: 'preview',
      component: Preview
    },
    {
      path: '/apply',
      name: 'apply',
      component: Apply
    },
    {
      path: '/settings',
      name: 'settings',
      component: Settings
    }
  ]
})

export default router