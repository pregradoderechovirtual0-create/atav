const CACHE_PREFIXES = ['sol-estudiante:', 'perfil-contacto:'] as const
const CACHE_KEYS = ['dashboard:parciales-proximos', 'aspirantes'] as const

export function limpiarCachesApp(uid?: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i)
      if (!key) continue

      if (CACHE_PREFIXES.some(p => key.startsWith(p))) {
        if (!uid || key.includes(uid)) localStorage.removeItem(key)
        continue
      }

      if (uid) continue

      if (CACHE_KEYS.includes(key as typeof CACHE_KEYS[number])) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // private mode / quota
  }
}
