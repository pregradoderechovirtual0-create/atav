export type TipoSolicitudEstudiante = 'flexibilizaciones' | 'supletorios' | 'habilitaciones'

const CACHE_TTL_MS = 5 * 60 * 1000

const cacheKey = (uid: string, tipo: TipoSolicitudEstudiante) => `sol-estudiante:${tipo}:${uid}`

interface CacheEnvelope<T> {
  data: T[]
  ts: number
}

function parseCache<T>(raw: string): T[] | null {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as T[]
    if (parsed && Array.isArray(parsed.data) && typeof parsed.ts === 'number') {
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
      return parsed.data as T[]
    }
    return null
  } catch {
    return null
  }
}

export function leerCacheSolicitudes<T>(uid: string, tipo: TipoSolicitudEstudiante): T[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid, tipo))
    if (!raw) return null
    return parseCache<T>(raw)
  } catch {
    return null
  }
}

export function guardarCacheSolicitudes<T>(uid: string, tipo: TipoSolicitudEstudiante, data: T[]) {
  try {
    const envelope: CacheEnvelope<T> = { data, ts: Date.now() }
    localStorage.setItem(cacheKey(uid, tipo), JSON.stringify(envelope))
  } catch {
    // ignore quota / private mode
  }
}
