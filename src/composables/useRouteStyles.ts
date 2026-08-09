import { watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

const loaded = new Set<string>()

function loadRouteStyles(path: string) {
  if (path.startsWith('/director') && !loaded.has('director')) {
    loaded.add('director')
    void import('../styles/director-list-page.css')
    void import('../styles/director-modal.css')
  }
}

export function useRouteStyles(route: RouteLocationNormalizedLoaded) {
  watch(
    () => route.path,
    (path) => loadRouteStyles(path),
    { immediate: true },
  )
}
