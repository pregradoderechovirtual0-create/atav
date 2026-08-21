import type { Router } from 'vue-router'
import { rutaInicioPorRol } from '@/lib/nucleo/rutas'
import {
  validarSesionConServidor,
  puedeAccederRuta,
  sincronizarSesionLocal,
  cerrarSesion,
  marcarMotivoCierreSesion,
} from '@/lib/autenticacion/session'

export function registerRouterGuards(router: Router) {
  router.beforeEach(async (to, _from, next) => {
    if (to.name === 'error' || to.path.startsWith('/error/')) {
      return next()
    }

    const validacion = await validarSesionConServidor()

    if (to.path === '/' || to.path === '/registro') {
      if (validacion.valida) {
        sincronizarSesionLocal(validacion.sesion)
        return next(rutaInicioPorRol(validacion.sesion.rol))
      }
      if (validacion.motivo !== 'sin_sesion') {
        marcarMotivoCierreSesion(validacion.motivo)
        await cerrarSesion()
      }
      return next()
    }

    if (!validacion.valida) {
      if (validacion.motivo !== 'sin_sesion') {
        marcarMotivoCierreSesion(validacion.motivo)
        await cerrarSesion()
      }
      return next('/')
    }

    sincronizarSesionLocal(validacion.sesion)

    if (!puedeAccederRuta(validacion.sesion.rol, to.path)) {
      return next({
        name: 'error',
        params: { code: '403' },
        query: { from: to.fullPath },
      })
    }

    next()
  })

  router.onError(error => {
    console.error('Error de navegación:', error)
    router.push({ name: 'error', params: { code: '500' } }).catch(() => {})
  })
}
