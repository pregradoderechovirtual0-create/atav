import { onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export function useNetworkStatus() {
  const router = useRouter()
  const route = useRoute()

  const irOfflineSiNecesario = () => {
    if (navigator.onLine) return
    if (route.path === '/' || route.name === 'error') return
    router.push({ name: 'error', params: { code: 'offline' } }).catch(() => {})
  }

  onMounted(() => {
    window.addEventListener('offline', irOfflineSiNecesario)
    irOfflineSiNecesario()
  })

  onUnmounted(() => {
    window.removeEventListener('offline', irOfflineSiNecesario)
  })
}
