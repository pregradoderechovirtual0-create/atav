import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { labelCausaFlexibilidad } from '@/lib/flexibilidadCatalogo'
import {
  guardarCacheDashboardSolicitudes,
  mergeDashboardSolicitudes,
  desdeFlexDoc,
  desdeHabDoc,
  desdeSupDoc,
} from '@/lib/dashboardSolicitudes'
import { guardarCacheSolicitudes } from '@/lib/solicitudesEstudianteCache'

const formatFechaSolicitud = (ts: any) => {
  if (ts?.toDate) {
    return ts.toDate().toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  return '—'
}

const mapEstado = (estado: string) => {
  const e = (estado || 'pendiente').toLowerCase().trim()
  if (e === 'aprobada') return 'Aprobada'
  if (e === 'rechazada') return 'Rechazada'
  return 'Pendiente'
}

export async function precargarCachesSolicitudesEstudiante(uid: string) {
  const [flexSnap, supSnap, habSnap] = await Promise.all([
    getDocs(query(collection(db, 'flexibilizaciones'), where('estudiante_id', '==', uid))),
    getDocs(query(collection(db, 'supletorios'), where('estudiante_id', '==', uid))),
    getDocs(query(collection(db, 'habilitaciones'), where('estudiante_id', '==', uid))),
  ])

  const flexItems = flexSnap.docs.map(docSnap => {
    const d = docSnap.data()
    return {
      docId: docSnap.id,
      id: docSnap.id.slice(0, 8).toUpperCase(),
      nombre: d.nombre || '',
      identificacion: d.identificacion || '',
      parcial: parseInt(d.parcial, 10) || 0,
      curso: d.curso || '',
      materia: d.curso_label || d.curso || '—',
      fecha: d.fecha_creacion?.toDate().toISOString().split('T')[0] || '',
      fechaSolicitud: formatFechaSolicitud(d.fecha_creacion),
      estado: mapEstado(d.estado || 'pendiente'),
      motivo_rechazo: d.motivo_rechazo || '',
      justa_causa: d.justa_causa_label || labelCausaFlexibilidad(d.justa_causa),
      correo: d.correo || '',
      celular: d.celular || '',
      fecha_parcial: d.fecha_parcial || '',
      hora_parcial: d.hora_parcial || '',
      descripcion: d.descripcion || '',
      pdf_url: d.pdf_url || '',
    }
  }).sort((a, b) => b.fecha.localeCompare(a.fecha))
  guardarCacheSolicitudes(uid, 'flexibilizaciones', flexItems)

  const supItems = supSnap.docs.map(doc => {
    const d = doc.data()
    return {
      id: doc.id.slice(0, 8).toUpperCase(),
      curso: d.nombre_curso || d.curso || '—',
      fecha: d.fecha_creacion?.toDate().toISOString().split('T')[0] || '',
      estado: mapEstado(d.estado || 'pendiente'),
      motivo_rechazo: d.motivo_rechazo || '',
    }
  })
  guardarCacheSolicitudes(uid, 'supletorios', supItems)

  const habItems = habSnap.docs.map(doc => {
    const d = doc.data()
    return {
      id: doc.id.slice(0, 8).toUpperCase(),
      curso: d.nombre_curso || d.curso || '—',
      fecha: d.fecha_creacion?.toDate().toISOString().split('T')[0] || '',
      estado: mapEstado(d.estado || 'pendiente'),
      motivo_rechazo: d.motivo_rechazo || '',
    }
  })
  guardarCacheSolicitudes(uid, 'habilitaciones', habItems)

  const dashboard = mergeDashboardSolicitudes([
    ...flexSnap.docs.map(doc => desdeFlexDoc(doc.id, doc.data())),
    ...habSnap.docs.map(doc => desdeHabDoc(doc.id, doc.data())),
    ...supSnap.docs.map(doc => desdeSupDoc(doc.id, doc.data())),
  ])
  guardarCacheDashboardSolicitudes(uid, dashboard)
}
