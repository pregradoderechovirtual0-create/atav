import { createApp } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import App from './App.vue'
import './style.css'

// Entrada pública: login en el bundle inicial para primera carga rápida
import Login from './views/auth/Login.vue'

import { rutaInicioPorRol } from './lib/rutas'
import { obtenerSesion, puedeAccederRuta, sincronizarSesionLocal } from './lib/session'

const lazy = (factory: () => Promise<{ default: unknown }>) => factory

const routes: RouteRecordRaw[] = [
  { path: '/', component: Login },

  // Perfil global
  { path: '/perfil', component: lazy(() => import('./views/shared/Perfil.vue')) },
  { path: '/perfil/editar', redirect: '/perfil' },

  // Docente
  { path: '/docente/dashboard', component: lazy(() => import('./views/docente/Dashboard.vue')) },
  { path: '/docente/crear-solicitud', component: lazy(() => import('./views/docente/CrearSolicitudDocente.vue')) },
  { path: '/docente/mis-solicitudes', component: lazy(() => import('./views/docente/MisSolicitudes.vue')) },
  { path: '/docente/materias-asignadas', component: lazy(() => import('./views/docente/MateriasAsignadas.vue')) },
  { path: '/docente/solicitud/:id', component: lazy(() => import('./views/docente/DetalleSolicitud.vue')) },
  { path: '/docente/notificaciones', component: lazy(() => import('./views/shared/Notificaciones.vue')) },
  { path: '/docente/calendario', component: lazy(() => import('./views/shared/Calendario.vue')) },
  { path: '/docente/recursos', component: lazy(() => import('./views/shared/Recursos.vue')) },

  // Director
  { path: '/director', component: lazy(() => import('./views/director/DirectorDashboard.vue')) },
  { path: '/director/solicitudes', component: lazy(() => import('./views/director/DirectorSolicitudes.vue')) },
  { path: '/director/reportes', component: lazy(() => import('./views/director/DirectorReportes.vue')) },
  { path: '/director/notificaciones', component: lazy(() => import('./views/shared/Notificaciones.vue')) },
  { path: '/director/usuarios', component: lazy(() => import('./views/director/DIrectorUsuarios.vue')) },
  { path: '/director/usuarios/crear', component: lazy(() => import('./views/director/DirectorCrearUsuarios.vue')) },
  { path: '/director/llamadas', component: lazy(() => import('./views/director/DirectorLlamadas.vue')) },
  { path: '/director/aspirantes', component: lazy(() => import('./views/director/DirectorCrearAspirante.vue')) },
  { path: '/director/aspirantes/editar/:cedula', component: lazy(() => import('./views/director/DirectorCrearAspirante.vue')) },
  { path: '/director/restablecer-password/:cedula', component: lazy(() => import('./views/director/RestablecerPassword.vue')) },
  { path: '/director/calendario', component: lazy(() => import('./views/shared/Calendario.vue')) },
  { path: '/director/materias', component: lazy(() => import('./views/director/DirectorMaterias.vue')) },
  { path: '/director/parciales', component: lazy(() => import('./views/director/DirectorParciales.vue')) },
  { path: '/director/recursos', component: lazy(() => import('./views/shared/Recursos.vue')) },

  // Estudiante
  { path: '/estudiante', component: lazy(() => import('./views/estudiante/EstudianteDashboard.vue')) },
  { path: '/estudiante/crear-solicitud', component: lazy(() => import('./views/estudiante/EstudianteCrearSolicitud.vue')) },
  { path: '/estudiante/mis-solicitudes', component: lazy(() => import('./views/docente/MisSolicitudes.vue')) },
  { path: '/estudiante/notificaciones', component: lazy(() => import('./views/shared/Notificaciones.vue')) },
  { path: '/estudiante/flexibilidad', component: lazy(() => import('./views/estudiante/EstudianteFlexibilidad.vue')) },
  { path: '/estudiante/supletorios', component: lazy(() => import('./views/estudiante/EstudianteSupletorios.vue')) },
  { path: '/estudiante/habilitaciones', component: lazy(() => import('./views/estudiante/EstudianteHabilitaciones.vue')) },
  { path: '/estudiante/calendario', component: lazy(() => import('./views/shared/Calendario.vue')) },
  { path: '/estudiante/recursos', component: lazy(() => import('./views/shared/Recursos.vue')) },

  { path: '/error/:code', name: 'error', component: lazy(() => import('./views/shared/ErrorPage.vue')), props: true },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: to => ({
      name: 'error',
      params: { code: '404' },
      query: to.path !== '/' ? { from: to.fullPath } : {},
    }),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  if (to.name === 'error' || to.path.startsWith('/error/')) {
    return next()
  }

  const sesion = await obtenerSesion()

  if (to.path === '/' || to.path === '/registro') {
    if (sesion) return next(rutaInicioPorRol(sesion.rol))
    return next()
  }

  if (!sesion) return next('/')

  sincronizarSesionLocal(sesion)

  if (!puedeAccederRuta(sesion.rol, to.path)) {
    return next({
      name: 'error',
      params: { code: '403' },
      query: { from: to.fullPath },
    })
  }

  next()
})

router.onError((error) => {
  console.error('Error de navegación:', error)
  router.push({ name: 'error', params: { code: '500' } }).catch(() => {})
})

createApp(App).use(router).mount('#app')
