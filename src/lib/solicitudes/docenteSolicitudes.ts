import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface SolicitudDocente {
  id: string
  usuario_id: string
  tipo_ausentismo: string
  tipoLabel: string
  fecha_inicio: string
  fecha_fin: string
  materia: string
  materia_codigo: string
  descripcion: string
  tipo_reprogramacion: string
  tipoReprogramacionLabel: string
  fechas_reprogramacion: string[]
  estado: string
  estadoLabel: string
  estadoClass: string
  motivo_rechazo: string
  fecha: string
  fechaSort: number
  reprogramacionTexto: string
  pdf_url: string
}

export const TIPOS_AUSENTISMO = [
  { id: 'cita-medica', label: 'Cita médica', description: 'Consultas y procedimientos médicos' },
  { id: 'calamidad', label: 'Calamidad familiar', description: 'Situaciones familiares urgentes' },
  { id: 'diligencia', label: 'Diligencia de trabajo', description: 'Actividades laborales institucionales' },
  { id: 'otro', label: 'Otro', description: 'Otros motivos justificados' },
] as const

export const TIPOS_REPROGRAMACION = [
  { id: 'presencial', label: 'Clase presencial', description: 'Reprogramar en horario diferente' },
  { id: 'virtual', label: 'Clase virtual', description: 'Sesión sincrónica en línea' },
  { id: 'grabada', label: 'Clase grabada', description: 'Material pregrabado para estudiantes' },
] as const

export const labelTipoAusentismo = (id: string) =>
  TIPOS_AUSENTISMO.find(t => t.id === id)?.label ?? id

export const labelTipoReprogramacion = (id: string) =>
  TIPOS_REPROGRAMACION.find(t => t.id === id)?.label ?? id

export const mapEstadoDocente = (estado: string) => {
  const e = (estado || 'creada').toLowerCase()
  switch (e) {
    case 'aprobada':
      return { label: 'Aprobada', class: 'estado-aprobada', calendario: 'aprobada' }
    case 'rechazada':
      return { label: 'Rechazada', class: 'estado-rechazada', calendario: 'rechazada' }
    case 'en_revision':
      return { label: 'En revisión', class: 'estado-revision', calendario: 'pendiente' }
    case 'cerrada':
      return { label: 'Cerrada', class: 'estado-cerrada', calendario: 'aprobada' }
    default:
      return { label: 'Pendiente', class: 'estado-pendiente', calendario: 'pendiente' }
  }
}

const extraerFecha = (timestamp: any): { iso: string; sort: number } => {
  if (!timestamp) return { iso: '', sort: 0 }
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return {
    iso: date.toISOString().split('T')[0],
    sort: date.getTime(),
  }
}

export const formatFechaISO = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const formatFechaHoraSolicitud = (valor: string) => {
  if (!valor) return ''
  if (valor.includes('T')) {
    const [fecha, hora] = valor.split('T')
    const [y, m, d] = fecha.split('-')
    const hh = hora?.slice(0, 5) || ''
    return `${d}/${m}/${y} ${hh}`
  }
  return formatFechaISO(valor)
}

const reprogramacionResumen = (data: Record<string, any>) => {
  const tipo = labelTipoReprogramacion(data.tipo_reprogramacion || '')
  const fechas = (data.fechas_reprogramacion || []).filter(Boolean)
  if (!fechas.length) return tipo || '—'
  return `${tipo} · ${formatFechaHoraSolicitud(fechas[0])}`
}

export const mapDocSolicitud = (id: string, data: Record<string, any>): SolicitudDocente => {
  const { iso, sort } = extraerFecha(data.fecha_creacion || data.creadoEn)
  const estado = mapEstadoDocente(data.estado || 'creada')
  return {
    id,
    usuario_id: data.usuario_id || '',
    tipo_ausentismo: data.tipo_ausentismo || '',
    tipoLabel: labelTipoAusentismo(data.tipo_ausentismo || ''),
    fecha_inicio: data.fecha_inicio || '',
    fecha_fin: data.fecha_fin || '',
    materia: data.materia_label || data.materia || '—',
    materia_codigo: data.materia_codigo || '',
    descripcion: data.descripcion || '',
    tipo_reprogramacion: data.tipo_reprogramacion || '',
    tipoReprogramacionLabel: labelTipoReprogramacion(data.tipo_reprogramacion || ''),
    fechas_reprogramacion: data.fechas_reprogramacion || [],
    estado: data.estado || 'creada',
    estadoLabel: estado.label,
    estadoClass: estado.class,
    motivo_rechazo: data.motivo_rechazo || '',
    fecha: iso,
    fechaSort: sort,
    reprogramacionTexto: reprogramacionResumen(data),
    pdf_url: data.pdf_url || '',
  }
}

export async function fetchSolicitudesDocente(uid: string): Promise<SolicitudDocente[]> {
  const q = query(collection(db, 'solicitudes'), where('usuario_id', '==', uid))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => mapDocSolicitud(d.id, d.data()))
    .sort((a, b) => b.fechaSort - a.fechaSort)
}

export async function fetchSolicitudDocente(id: string, uid: string): Promise<SolicitudDocente | null> {
  const snap = await getDoc(doc(db, 'solicitudes', id))
  if (!snap.exists()) return null
  const data = snap.data()
  if (data.usuario_id !== uid) return null
  return mapDocSolicitud(snap.id, data)
}

export interface CrearSolicitudDocenteInput {
  usuario_id: string
  cedula?: string
  docente_nombre: string
  tipo_ausentismo: string
  fecha_inicio: string
  fecha_fin: string
  materia_codigo: string
  materia_label: string
  descripcion: string
  tipo_reprogramacion: string
  fechas_reprogramacion: string[]
  pdf_url?: string

}

export async function crearSolicitudDocente(input: CrearSolicitudDocenteInput) {
  const fechas = (input.fechas_reprogramacion || []).filter(Boolean)

  if (!input.usuario_id?.trim()) {
    throw new Error('Sesión no válida. Vuelve a iniciar sesión.')
  }
  if (!input.tipo_ausentismo?.trim()) {
    throw new Error('Selecciona el tipo de ausentismo.')
  }
  if (!input.fecha_inicio || !input.fecha_fin) {
    throw new Error('Completa las fechas de inicio y fin.')
  }
  if (!input.materia_codigo?.trim()) {
    throw new Error('Selecciona la materia afectada.')
  }
  if (!input.descripcion?.trim()) {
    throw new Error('Escribe una descripción.')
  }
  if (!input.tipo_reprogramacion?.trim()) {
    throw new Error('Selecciona el tipo de reprogramación.')
  }
  if (!fechas.length) {
    throw new Error('Indica al menos una fecha de reprogramación.')
  }

  const payload = {
    usuario_id: input.usuario_id.trim(),
    cedula: (input.cedula || '').trim(),
    docente_nombre: (input.docente_nombre || '').trim(),
    tipo_ausentismo: input.tipo_ausentismo.trim(),
    tipo: 'inasistencia',
    fecha_inicio: input.fecha_inicio,
    fecha_fin: input.fecha_fin,
    materia_codigo: input.materia_codigo.trim(),
    materia_label: (input.materia_label || input.materia_codigo).trim(),
    materia: (input.materia_label || input.materia_codigo).trim(),
    descripcion: input.descripcion.trim(),
    tipo_reprogramacion: input.tipo_reprogramacion.trim(),
    fechas_reprogramacion: fechas,
    estado: 'creada',
    motivo_rechazo: '',
    fecha_creacion: serverTimestamp(),
    pdf_url: input.pdf_url || '',
    creadoEn: serverTimestamp(),
  }

  return addDoc(collection(db, 'solicitudes'), payload)
}

export const fechaDeEvento = (valor: string) => {
  if (!valor) return ''
  return valor.includes('T') ? valor.split('T')[0] : valor
}

export function eventosCalendarioDesdeSolicitud(sol: SolicitudDocente) {
  const estadoCal = mapEstadoDocente(sol.estado).calendario
  const eventos: Array<{
    id: string
    titulo: string
    fecha: string
    tipo: string
    estado: string
    descripcion: string
    motivoRechazo: string
  }> = []

  if (sol.fecha_inicio) {
    eventos.push({
      id: `${sol.id}-inicio`,
      titulo: `Ausencia · ${sol.materia}`,
      fecha: sol.fecha_inicio,
      tipo: 'solicitud',
      estado: estadoCal,
      descripcion: sol.tipoLabel,
      motivoRechazo: sol.motivo_rechazo,
    })
  }

  if (sol.fecha_fin && sol.fecha_fin !== sol.fecha_inicio) {
    eventos.push({
      id: `${sol.id}-fin`,
      titulo: `Fin ausencia · ${sol.materia}`,
      fecha: sol.fecha_fin,
      tipo: 'solicitud',
      estado: estadoCal,
      descripcion: sol.tipoLabel,
      motivoRechazo: sol.motivo_rechazo,
    })
  }

  sol.fechas_reprogramacion.forEach((f, i) => {
    const fecha = fechaDeEvento(f)
    if (!fecha) return
    eventos.push({
      id: `${sol.id}-repro-${i}`,
      titulo: `Reprogramación · ${sol.materia}`,
      fecha,
      tipo: 'solicitud',
      estado: estadoCal,
      descripcion: `${sol.tipoReprogramacionLabel} · ${formatFechaHora(f)}`,
      motivoRechazo: '',
    })
  })

  return eventos
}
