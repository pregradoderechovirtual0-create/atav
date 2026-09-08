import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { applyThemeForRole } from '@/lib/nucleo/theme'
import {
  validarSesionConServidor,
  sincronizarSesionLocal,
  cerrarSesion,
  marcarMotivoCierreSesion,
} from '@/lib/autenticacion/session'

/** Revalida la sesión al volver a la pestaña o restaurar la página. */
export function useValidarSesionAlVolver() {
  const route = useRoute()
  const router = useRouter()

  const esRutaPublica = () => {
    const path = route.path
    return path === '/' || path === '/registro' || path.startsWith('/error/')
  }

  const revisarSesion = async () => {
    if (esRutaPublica()) return

    const validacion = await validarSesionConServidor()

    if (validacion.valida) {
      sincronizarSesionLocal(validacion.sesion)
      applyThemeForRole(validacion.sesion.rol)
      return
    }

    if (validacion.motivo !== 'sin_sesion') {
      marcarMotivoCierreSesion(validacion.motivo)
    }

    await cerrarSesion()
    await router.replace('/')
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') void revisarSesion()
  }

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) void revisarSesion()
  }

  onMounted(() => {
    void revisarSesion()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pageshow', onPageShow)
  })
}
