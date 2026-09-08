import type { SolicitudDirector } from '@/lib/director/directorSolicitudesAggregate'
import { normalizarEstadoFirestore } from '@/lib/solicitudes/dashboardSolicitudes'

export const TIPOS_GESTIONABLES = ['inasistencia', 'flexibilizacion'] as const
export const TIPOS_TRAZABILIDAD = ['habilitacion', 'supletorio'] as const

export function esPendienteDirector(estado: string): boolean {
  const e = normalizarEstadoFirestore(estado)
  return e === 'pendiente' || e === 'creada' || e === 'en_revision'
}

export function esAprobadaDirector(estado: string): boolean {
  const e = normalizarEstadoFirestore(estado)
  return e === 'aprobada' || e === 'cerrada'
}

export function esRechazadaDirector(estado: string): boolean {
  return normalizarEstadoFirestore(estado) === 'rechazada'
}

export interface StatsDirector {
  total: number
  totalGestionables: number
  pendientes: number
  aprobadas: number
  rechazadas: number
  trazabilidad: {
    total: number
    habilitaciones: number
    supletorios: number
  }
}

export function computarStatsDirector(solicitudes: SolicitudDirector[]): StatsDirector {
  const gestionables = solicitudes.filter(s =>
    TIPOS_GESTIONABLES.includes(s.tipo as typeof TIPOS_GESTIONABLES[number]),
  )
  const trazables = solicitudes.filter(s =>
    TIPOS_TRAZABILIDAD.includes(s.tipo as typeof TIPOS_TRAZABILIDAD[number]),
  )

  return {
    total: solicitudes.length,
    totalGestionables: gestionables.length,
    pendientes: gestionables.filter(s => esPendienteDirector(s.estado)).length,
    aprobadas: gestionables.filter(s => esAprobadaDirector(s.estado)).length,
    rechazadas: gestionables.filter(s => esRechazadaDirector(s.estado)).length,
    trazabilidad: {
      total: trazables.length,
      habilitaciones: trazables.filter(s => s.tipo === 'habilitacion').length,
      supletorios: trazables.filter(s => s.tipo === 'supletorio').length,
    },
  }
}
