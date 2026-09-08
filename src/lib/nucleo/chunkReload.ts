const CHUNK_RELOAD_KEY = 'atav-chunk-reload'

export function esErrorCargaChunk(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()
  return (
    lower.includes('failed to fetch dynamically imported module')
    || lower.includes('importing a module script failed')
    || lower.includes('loading chunk')
    || lower.includes('error loading dynamically imported module')
  )
}

/** Recarga una vez tras deploy; evita bucle infinito al fallar ErrorPage lazy. */
export function recargarPorChunkDesactualizado(): boolean {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  window.location.reload()
  return true
}

export function limpiarMarcaRecargaChunk() {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY)
}
