import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/workbench',
    },
    {
      path: '/workbench',
      name: 'Workbench',
      component: () => import('@/views/Workbench.vue'),
      meta: { title: '告警工作台' },
    },
    {
      path: '/alerts/:id',
      name: 'AlertDetail',
      component: () => import('@/views/AlertDetail.vue'),
      meta: { title: '告警详情' },
    },
    {
      path: '/elders',
      name: 'ElderList',
      component: () => import('@/views/ElderList.vue'),
      meta: { title: '老人档案' },
    },
    {
      path: '/elders/:id',
      name: 'ElderDetail',
      component: () => import('@/views/ElderDetail.vue'),
      meta: { title: '档案详情' },
    },
    {
      path: '/me',
      name: 'Me',
      component: () => import('@/views/Me.vue'),
      meta: { title: '个人中心' },
    },
    {
      path: '/me/fp-stats',
      name: 'FpStats',
      component: () => import('@/views/FpStats.vue'),
      meta: { title: '误报统计' },
    },
    {
      path: '/building/alerts',
      name: 'BuildingAlerts',
      component: () => import('@/views/building/BuildingAlerts.vue'),
      meta: { title: '楼长告警', role: 'building_manager' },
    },
    {
      path: '/meals',
      name: 'MealCheck',
      component: () => import('@/views/MealCheck.vue'),
      meta: { title: '食堂签到' },
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/Admin.vue'),
      meta: { title: '人员管理', role: 'director' },
    },
  ],
})

router.beforeEach((to) => {
  document.title = `${to.meta.title || '溪东养老'} - 溪东社区`
})

export default router
