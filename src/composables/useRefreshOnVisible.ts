import { onMounted, onUnmounted } from 'vue'

/** Vuelve a cargar datos cuando el usuario regresa a la pestaña o app. */
export function useRefreshOnVisible(refresh: () => void | Promise<void>) {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void refresh()
  }

  onMounted(() => document.addEventListener('visibilitychange', onVisible))
  onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))
}
