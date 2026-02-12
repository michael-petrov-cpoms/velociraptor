import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      meta: { title: 'Teams' },
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/team/:id',
      name: 'team-detail',
      meta: { title: 'Team Detail' },
      component: () => import('../views/TeamDetailView.vue'),
    },
    {
      path: '/team/:id/log',
      name: 'log-sprint',
      meta: { title: 'Log Sprint' },
      component: () => import('../views/LogSprintView.vue'),
    },
    {
      path: '/team/:id/plan',
      name: 'plan-sprint',
      meta: { title: 'Plan Sprint' },
      component: () => import('../views/PlanSprintView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} — Velociraptor` : 'Velociraptor'
})

export default router
