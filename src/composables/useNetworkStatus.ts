import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

/** Rutas con formulario largo: no redirigir a /error/offline para no perder el contexto visual. */
const RUTAS_FORMULARIO_SOLICITUD = [
  '/docente/crear-solicitud',
  '/estudiante/flexibilidad',
  '/estudiante/supletorios',
  '/estudiante/habilitaciones',
  '/estudiante/crear-solicitud',
]

export const conexionEnLinea = ref(
  typeof navigator !== 'undefined' ? navigator.onLine : true,
)

export function useNetworkStatus() {
  const router = useRouter()
  const route = useRoute()

  const actualizarEstado = () => {
    conexionEnLinea.value = navigator.onLine
  }

  const irOfflineSiNecesario = () => {
    if (navigator.onLine) return
    if (route.path === '/' || route.path === '/registro' || route.name === 'error') return
    if (RUTAS_FORMULARIO_SOLICITUD.some(p => route.path.startsWith(p))) return
    router.push({ name: 'error', params: { code: 'offline' } }).catch(() => {})
  }

  const onOffline = () => {
    actualizarEstado()
    irOfflineSiNecesario()
  }

  const onOnline = () => {
    actualizarEstado()
  }

  onMounted(() => {
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    actualizarEstado()
    irOfflineSiNecesario()
  })

  onUnmounted(() => {
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('online', onOnline)
  })
}
