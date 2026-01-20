import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/team/:id',
      name: 'team-detail',
      component: () => import('../views/TeamDetailView.vue'),
    },
    {
      path: '/team/:id/log',
      name: 'log-sprint',
      component: () => import('../views/LogSprintView.vue'),
    },
    {
      path: '/team/:id/plan',
      name: 'plan-sprint',
      component: () => import('../views/PlanSprintView.vue'),
    },
  ],
})

export default router
