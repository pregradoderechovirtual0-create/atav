import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './rutas'
import { registerRouterGuards } from './proteccion'

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

registerRouterGuards(router)
