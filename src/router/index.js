import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import Order from '../views/Order.vue'
import routesSccess from './success'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/order/type/:resourceType/resource/:resourceId',
      name: 'order',
      component: Order
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue')
    },
    ...routesSccess,
    {
      path: '/:pathMatch(.*)',
      redirect: '/404'
    }
  ]
})

export default router
