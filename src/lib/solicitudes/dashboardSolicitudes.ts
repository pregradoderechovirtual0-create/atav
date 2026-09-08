import { leerCacheSolicitudes } from '@/lib/solicitudes/solicitudesEstudianteCache'

export interface DashboardSolicitud {
  id: string
  tipo: 'flexibilizacion' | 'habilitacion' | 'supletorio'
  tipoLabel: string
  curso: string
  detalle: string
  fecha: string
  fechaSort: number
  estado: string
  estadoClass: string
  motivoRechazo: string
  ruta: string
}

const DASHBOARD_KEY = (uid: string) => `sol-estudiante:dashboard:${uid}`
const PARCIALES_KEY = 'dashboard:parciales-proximos'

export const normalizarEstadoFirestore = (estado: string) =>
  (estado || 'pendiente').toLowerCase().trim().replace(/\s+/g, '_')

export function labelEstadoUI(estado: string): string {
  const e = normalizarEstadoFirestore(estado)
  if (e === 'aprobada' || e === 'cerrada') return 'Aprobada'
  if (e === 'rechazada') return 'Rechazada'
  if (e === 'en_revision') return 'En revisión'
  return 'Pendiente'
}

export const mapEstadoDashboard = (estado: string) => {
  switch (normalizarEstadoFirestore(estado)) {
    case 'aprobada':
      return { label: 'Aprobada', class: 'approved' }
    case 'rechazada':
      return { label: 'Rechazada', class: 'rejected' }
    case 'en_revision':
      return { label: 'En revisión', class: 'review' }
    default:
      return { label: 'Pendiente', class: 'pending' }
  }
}

const estadoClassDesdeLabel = (label: string) => {
  if (label === 'Aprobada') return 'approved'
  if (label === 'Rechazada') return 'rejected'
  if (label === 'En revisión') return 'review'
  return 'pending'
}

export const extraerFechaSort = (timestamp: any): { iso: string; sort: number } => {
  if (!timestamp) return { iso: '', sort: 0 }
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return {
    iso: date.toISOString().split('T')[0],
    sort: date.getTime(),
  }
}

export function desdeFlexDoc(docId: string, d: Record<string, any>): DashboardSolicitud {
  const { iso, sort } = extraerFechaSort(d.fecha_creacion)
  const estado = mapEstadoDashboard(d.estado || 'pendiente')
  return {
    id: docId.slice(0, 8).toUpperCase(),
    tipo: 'flexibilizacion',
    tipoLabel: 'Flexibilización',
    curso: d.curso_label || d.curso || '—',
    detalle: d.parcial ? `Parcial ${d.parcial}` : '',
    fecha: iso,
    fechaSort: sort,
    estado: estado.label,
    estadoClass: estado.class,
    motivoRechazo: d.motivo_rechazo || '',
    ruta: '/estudiante/flexibilidad',
  }
}

export function desdeHabDoc(docId: string, d: Record<string, any>): DashboardSolicitud {
  const { iso, sort } = extraerFechaSort(d.fecha_creacion)
  const estado = mapEstadoDashboard(d.estado || 'pendiente')
  return {
    id: docId.slice(0, 8).toUpperCase(),
    tipo: 'habilitacion',
    tipoLabel: 'Habilitación',
    curso: d.nombre_curso || '—',
    detalle: d.semestre ? `Sem. ${d.semestre}` : '',
    fecha: iso,
    fechaSort: sort,
    estado: estado.label,
    estadoClass: estado.class,
    motivoRechazo: d.motivo_rechazo || '',
    ruta: '/estudiante/habilitaciones',
  }
}

export function desdeSupDoc(docId: string, d: Record<string, any>): DashboardSolicitud {
  const { iso, sort } = extraerFechaSort(d.fecha_creacion)
  const estado = mapEstadoDashboard(d.estado || 'pendiente')
  return {
    id: docId.slice(0, 8).toUpperCase(),
    tipo: 'supletorio',
    tipoLabel: 'Supletorio',
    curso: d.nombre_curso || d.curso || '—',
    detalle: d.semestre ? `Sem. ${d.semestre}` : '',
    fecha: iso,
    fechaSort: sort,
    estado: estado.label,
    estadoClass: estado.class,
    motivoRechazo: d.motivo_rechazo || '',
    ruta: '/estudiante/supletorios',
  }
}

export function mergeDashboardSolicitudes(items: DashboardSolicitud[]): DashboardSolicitud[] {
  return [...items].sort((a, b) => b.fechaSort - a.fechaSort)
}

export function leerCacheDashboardSolicitudes(uid: string): DashboardSolicitud[] | null {
  try {
    const raw = localStorage.getItem(DASHBOARD_KEY(uid))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as DashboardSolicitud[]
    if (parsed?.data && Array.isArray(parsed.data) && typeof parsed.ts === 'number') {
      if (Date.now() - parsed.ts > 5 * 60 * 1000) return null
      return parsed.data as DashboardSolicitud[]
    }
    return null
  } catch {
    return null
  }
}

export function guardarCacheDashboardSolicitudes(uid: string, data: DashboardSolicitud[]) {
  try {
    localStorage.setItem(DASHBOARD_KEY(uid), JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // ignore
  }
}

export function construirDashboardDesdeCachesSidebar(uid: string): DashboardSolicitud[] | null {
  const flex = leerCacheSolicitudes<any>(uid, 'flexibilizaciones')
  const hab = leerCacheSolicitudes<any>(uid, 'habilitaciones')
  const sup = leerCacheSolicitudes<any>(uid, 'supletorios')
  if (!flex && !hab && !sup) return null

  const items: DashboardSolicitud[] = []

  for (const item of flex ?? []) {
    items.push({
      id: item.id,
      tipo: 'flexibilizacion',
      tipoLabel: 'Flexibilización',
      curso: item.materia || item.curso || '—',
      detalle: item.parcial ? `Parcial ${item.parcial}` : '',
      fecha: item.fecha || '',
      fechaSort: item.fecha ? new Date(item.fecha).getTime() : 0,
      estado: item.estado || 'Pendiente',
      estadoClass: estadoClassDesdeLabel(item.estado || 'Pendiente'),
      motivoRechazo: item.motivo_rechazo || '',
      ruta: '/estudiante/flexibilidad',
    })
  }

  for (const item of hab ?? []) {
    items.push({
      id: item.id,
      tipo: 'habilitacion',
      tipoLabel: 'Habilitación',
      curso: item.curso || '—',
      detalle: '',
      fecha: item.fecha || '',
      fechaSort: item.fecha ? new Date(item.fecha).getTime() : 0,
      estado: item.estado || 'Pendiente',
      estadoClass: estadoClassDesdeLabel(item.estado || 'Pendiente'),
      motivoRechazo: item.motivo_rechazo || '',
      ruta: '/estudiante/habilitaciones',
    })
  }

  for (const item of sup ?? []) {
    items.push({
      id: item.id,
      tipo: 'supletorio',
      tipoLabel: 'Supletorio',
      curso: item.curso || '—',
      detalle: '',
      fecha: item.fecha || '',
      fechaSort: item.fecha ? new Date(item.fecha).getTime() : 0,
      estado: item.estado || 'Pendiente',
      estadoClass: estadoClassDesdeLabel(item.estado || 'Pendiente'),
      motivoRechazo: item.motivo_rechazo || '',
      ruta: '/estudiante/supletorios',
    })
  }

  return mergeDashboardSolicitudes(items)
}

export function leerCacheParcialesProximos(): any[] | null {
  try {
    const raw = localStorage.getItem(PARCIALES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function guardarCacheParcialesProximos(data: any[]) {
  try {
    localStorage.setItem(PARCIALES_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}
