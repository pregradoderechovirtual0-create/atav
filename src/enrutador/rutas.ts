import type { RouteRecordRaw } from 'vue-router'
import Login from '@/vistas/autenticacion/Login.vue'

const lazy = (factory: () => Promise<{ default: unknown }>) => factory

export const routes: RouteRecordRaw[] = [
  { path: '/', component: Login },

  { path: '/perfil', component: lazy(() => import('@/vistas/compartido/Perfil.vue')) },
  { path: '/perfil/editar', redirect: '/perfil' },

  { path: '/docente/dashboard', component: lazy(() => import('@/vistas/docente/DocenteDashboard.vue')) },
  { path: '/docente/crear-solicitud', component: lazy(() => import('@/vistas/docente/CrearSolicitudDocente.vue')) },
  { path: '/docente/mis-solicitudes', component: lazy(() => import('@/vistas/docente/MisSolicitudes.vue')) },
  { path: '/docente/materias-asignadas', component: lazy(() => import('@/vistas/docente/MateriasAsignadas.vue')) },
  { path: '/docente/solicitud/:id', component: lazy(() => import('@/vistas/docente/DetalleSolicitud.vue')) },
  { path: '/docente/notificaciones', component: lazy(() => import('@/vistas/compartido/Notificaciones.vue')) },
  { path: '/docente/calendario', component: lazy(() => import('@/vistas/compartido/Calendario.vue')) },
  { path: '/docente/recursos', component: lazy(() => import('@/vistas/compartido/Recursos.vue')) },

  { path: '/director', component: lazy(() => import('@/vistas/director/DirectorDashboard.vue')) },
  { path: '/director/solicitudes', component: lazy(() => import('@/vistas/director/DirectorSolicitudes.vue')) },
  { path: '/director/reportes', component: lazy(() => import('@/vistas/director/DirectorReportes.vue')) },
  { path: '/director/notificaciones', component: lazy(() => import('@/vistas/compartido/Notificaciones.vue')) },
  { path: '/director/usuarios', component: lazy(() => import('@/vistas/director/DirectorUsuarios.vue')) },
  { path: '/director/usuarios/crear', component: lazy(() => import('@/vistas/director/DirectorCrearUsuarios.vue')) },
  { path: '/director/llamadas', component: lazy(() => import('@/vistas/director/DirectorLlamadas.vue')) },
  { path: '/director/aspirantes', component: lazy(() => import('@/vistas/director/DirectorCrearAspirante.vue')) },
  { path: '/director/aspirantes/editar/:cedula', component: lazy(() => import('@/vistas/director/DirectorCrearAspirante.vue')) },
  { path: '/director/restablecer-password/:cedula', component: lazy(() => import('@/vistas/director/RestablecerPassword.vue')) },
  { path: '/director/calendario', component: lazy(() => import('@/vistas/compartido/Calendario.vue')) },
  { path: '/director/materias', component: lazy(() => import('@/vistas/director/DirectorMaterias.vue')) },
  { path: '/director/parciales', component: lazy(() => import('@/vistas/director/DirectorParciales.vue')) },
  { path: '/director/recursos', component: lazy(() => import('@/vistas/compartido/Recursos.vue')) },

  { path: '/estudiante', component: lazy(() => import('@/vistas/estudiante/EstudianteDashboard.vue')) },
  { path: '/estudiante/crear-solicitud', component: lazy(() => import('@/vistas/estudiante/EstudianteCrearSolicitud.vue')) },
  { path: '/estudiante/mis-solicitudes', component: lazy(() => import('@/vistas/docente/MisSolicitudes.vue')) },
  { path: '/estudiante/notificaciones', component: lazy(() => import('@/vistas/compartido/Notificaciones.vue')) },
  { path: '/estudiante/flexibilidad', component: lazy(() => import('@/vistas/estudiante/EstudianteFlexibilidad.vue')) },
  { path: '/estudiante/supletorios', component: lazy(() => import('@/vistas/estudiante/EstudianteSupletorios.vue')) },
  { path: '/estudiante/habilitaciones', component: lazy(() => import('@/vistas/estudiante/EstudianteHabilitaciones.vue')) },
  { path: '/estudiante/calendario', component: lazy(() => import('@/vistas/compartido/Calendario.vue')) },
  { path: '/estudiante/recursos', component: lazy(() => import('@/vistas/compartido/Recursos.vue')) },

  {
    path: '/error/:code',
    name: 'error',
    component: lazy(() => import('@/vistas/compartido/ErrorPage.vue')),
    props: true,
  },
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
