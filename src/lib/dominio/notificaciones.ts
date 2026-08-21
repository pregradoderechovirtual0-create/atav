import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type TipoNotificacion = 'success' | 'info' | 'warning' | 'error'

export interface NotificacionData {
  id: string
  titulo: string
  mensaje: string
  tipo: TipoNotificacion
  leida: boolean
  ruta: string | null
  fecha: string
  fechaSort: number
}

export interface CrearNotificacionInput {
  usuario_id: string
  titulo: string
  mensaje: string
  tipo?: TipoNotificacion
  ruta?: string | null
}

export const formatFechaRelativa = (ts: unknown): string => {
  if (!ts) return ''
  const d =
    typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as string | number)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'Hace un momento'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`
  if (diff < 172800) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export const mapNotificacionDoc = (id: string, data: Record<string, unknown>): NotificacionData => {
  const ts = data.fecha_creacion
  const d =
    ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : null

  return {
    id,
    titulo: (data.titulo as string) || 'Notificación',
    mensaje: (data.mensaje as string) || '',
    tipo: (data.tipo as TipoNotificacion) || 'info',
    leida: Boolean(data.leida),
    ruta: (data.ruta as string) || null,
    fecha: formatFechaRelativa(ts),
    fechaSort: d ? d.getTime() : 0,
  }
}

export const cargarNotificacionesUsuario = async (uid: string): Promise<NotificacionData[]> => {
  const q = query(collection(db, 'notificaciones'), where('usuario_id', '==', uid))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => mapNotificacionDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.fechaSort - a.fechaSort)
}

export const crearNotificacion = async (input: CrearNotificacionInput) => {
  await addDoc(collection(db, 'notificaciones'), {
    usuario_id: input.usuario_id,
    titulo: input.titulo,
    mensaje: input.mensaje,
    tipo: input.tipo || 'info',
    leida: false,
    ruta: input.ruta ?? null,
    fecha_creacion: serverTimestamp(),
  })
}

const ROLES_DIRECTOR = ['Director', 'Jefa Suprema'] as const

const obtenerUidsDirectores = async (): Promise<string[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'usuarios'), where('rol', 'in', [...ROLES_DIRECTOR])),
    )
    return snap.docs
      .map(d => d.data().auth_uid as string | undefined)
      .filter((uid): uid is string => Boolean(uid))
  } catch (error) {
    console.warn('No se pudieron obtener UIDs de directores:', error)
    return []
  }
}

export const notificarDirectores = async (
  input: Omit<CrearNotificacionInput, 'usuario_id'>
) => {
  const uids = await obtenerUidsDirectores()
  if (!uids.length) {
    console.warn('No hay directores con UID vinculado para notificar.')
    return
  }

  await Promise.all(uids.map(uid => crearNotificacion({ ...input, usuario_id: uid })))
}

export const rutaNotificacionEstudiante = (tipo: string): string => {
  const rutas: Record<string, string> = {
    flexibilizacion: '/estudiante/flexibilidad',
    habilitacion: '/estudiante/habilitaciones',
    supletorio: '/estudiante/supletorios',
  }
  return rutas[tipo] || '/estudiante'
}

export const rutaNotificacionesPorRol = (): string => {
  const rol = localStorage.getItem('rol')
  if (rol === 'Director' || rol === 'Jefa Suprema') return '/director/notificaciones'
  if (rol === 'Docente') return '/docente/notificaciones'
  return '/estudiante/notificaciones'
}
