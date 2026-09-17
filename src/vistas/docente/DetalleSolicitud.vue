<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth, db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { fetchSolicitudDocente, type SolicitudDocente } from '@/lib/solicitudes/docenteSolicitudes'

const route = useRoute()
const router = useRouter()
const solicitud = ref<SolicitudDocente | null>(null)
const cargando = ref(true)
const mensajeNotificacion = ref('')

const formatFecha = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const formatFechaHora = (valor: any) => {

  if (!valor) return '—'


  // Si viene como Timestamp de Firebase
  if (valor?.toDate) {

    const fecha = valor.toDate()

    return fecha.toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short'
    })

  }


  // Si viene como texto
  if (typeof valor === 'string') {

    if (valor.includes('T')) {

      const [fecha, hora] = valor.split('T')

      return `${formatFecha(fecha)} ${hora.slice(0,5)}`

    }

    return formatFecha(valor)

  }


  return '—'
}

const cargarMensajeNotificacion = async (
  uid:string,
  solicitudId:string
)=>{

  try {

    const q = query(
      collection(db,'notificaciones'),
      where('usuario_id','==',uid),
      where('solicitud_id','==',solicitudId)
    )


    const resultado = await getDocs(q)


    if(!resultado.empty){

      const data = resultado.docs[0].data()

      mensajeNotificacion.value = data.mensaje || ''

    }


  } catch(error){

    console.error(
      "Error buscando notificación:",
      error
    )

  }

}

const opcionesReprogramacion = computed(() =>
  (solicitud.value?.fechas_reprogramacion || [])
    .filter(Boolean)
    .map((f, i) => ({ fecha: f, index: i + 1 }))
)

const cargar = async (uid: string) => {

  const id = route.params.id as string

  console.log("ID recibido:", id)
  console.log("Usuario actual:", uid)

  cargando.value = true

  try {

    const data = await fetchSolicitudDocente(id, uid)

    console.log("Resultado Firebase:", data)

    if (!data) {

      console.warn("No llegó información de solicitud")

      return
    }

    solicitud.value = data

    await cargarMensajeNotificacion(
      uid,
      id
    )

  } catch(error){

    console.error(
      "ERROR cargando detalle:",
      error
    )

  } finally {

    cargando.value = false

  }
}

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) cargar(user.uid)
    else router.replace('/')
  })
})
</script>

<template>
  <div class="detalle-page role-page">
    <router-link to="/docente/mis-solicitudes" class="back-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
      </svg>
      Volver a mis solicitudes
    </router-link>

    <p v-if="cargando" class="empty-state">Cargando solicitud...</p>

    <template v-else-if="solicitud">
      <header class="detalle-header">
        <div>
          <p class="detalle-title">Solicitud #{{ solicitud.id.slice(0, 8).toUpperCase() }}</p>
          <p class="detalle-sub">{{ solicitud.tipoLabel }} · {{ solicitud.materia }}</p>
        </div>
        <span :class="['estado-chip', solicitud.estadoClass]">{{ solicitud.estadoLabel }}</span>
      </header>

      <section class="detalle-card">
        <h2 class="section-title">Información general</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Tipo de ausentismo</span>
            <span class="info-value">{{ solicitud.tipoLabel }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Materia</span>
            <span class="info-value">{{ solicitud.materia }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Fecha inicio</span>
            <span class="info-value">{{ formatFecha(solicitud.fecha_inicio) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Fecha fin</span>
            <span class="info-value">{{ formatFecha(solicitud.fecha_fin) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Fecha de solicitud</span>
            <span class="info-value">{{ formatFecha(solicitud.fecha) }}</span>
          </div>
        </div>
        <div class="info-block">
          <span class="info-label">Descripción</span>
          <p class="info-text">{{ solicitud.descripcion || '—' }}</p>
        </div>
      </section>

      <section v-if="solicitud.motivo_rechazo && solicitud.estadoLabel === 'Rechazada'" class="detalle-rechazo">
        <h2 class="section-title">Motivo de rechazo</h2>
        <p class="rechazo-text">{{ solicitud.motivo_rechazo }}</p>
      </section>

<section 
v-if="mensajeNotificacion"
class="detalle-card">

<h2 class="section-title">
Mensaje adicional
</h2>

<p class="info-text">
{{ mensajeNotificacion }}
</p>

</section>

    </template>
  </div>
</template>

<style scoped>
.detalle-page { display: flex; flex-direction: column; gap: 20px; }

.back-link {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 500; color: var(--color-text-secondary);
}
.back-link:hover { color: var(--color-accent); }

.detalle-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
}
.detalle-title { font-size: 22px; font-weight: 700; color: var(--color-text); margin: 0 0 4px; }
.detalle-sub { font-size: 13px; color: var(--color-text-muted); margin: 0; }

.estado-chip { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 99px; flex-shrink: 0; }
.estado-pendiente  { background: #fef3c7; color: #d97706; }
.estado-aprobada   { background: #f0fdf4; color: #16a34a; }
.estado-rechazada  { background: #fee2e2; color: #dc2626; }
.estado-revision   { background: #eff6ff; color: #2563eb; }
.estado-cerrada    { background: var(--color-border-light); color: var(--color-text-muted); }

.detalle-card {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); padding: 20px 22px;
}
.section-title {
  font-size: 13px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.4px; color: var(--color-text-muted); margin: 0 0 16px;
}
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; margin-bottom: 16px; }
.info-item { display: flex; flex-direction: column; gap: 4px; }
.info-item.full { grid-column: 1 / -1; }
.info-label { font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.info-value { font-size: 14px; font-weight: 500; color: var(--color-text); }
.info-block { padding-top: 4px; }
.info-text { margin: 6px 0 0; font-size: 14px; line-height: 1.6; color: var(--color-text); }

.opciones-list { display: flex; flex-direction: column; gap: 8px; }
.opcion-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; background: var(--color-background); border-radius: 8px;
  border: 1px solid var(--color-border-light);
}
.opcion-num { font-size: 12px; font-weight: 600; color: var(--color-text-muted); }
.opcion-fecha { font-size: 13px; color: var(--color-text); }

.detalle-rechazo {
  padding: 16px 18px; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-lg);
}
.detalle-rechazo .section-title { color: #b91c1c; margin-bottom: 8px; }
.rechazo-text { margin: 0; font-size: 14px; color: #dc2626; line-height: 1.55; }

.empty-state, .empty-inline { font-size: 13px; color: var(--color-text-muted); }
.empty-inline { margin: 0; }

.pdf-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-accent);
  background: var(--color-info-bg);
  padding: 10px 14px;
  border-radius: var(--radius);
  text-decoration: none;
  transition: opacity var(--transition);
}
.pdf-link:hover { opacity: 0.75; }

@media (max-width: 768px) {
  .detalle-header {
    flex-direction: column;
    gap: 10px;
  }

  .opcion-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .pdf-link {
    width: 100%;
    justify-content: center;
    box-sizing: border-box;
  }
}

@media (max-width: 640px) {
  .info-grid { grid-template-columns: 1fr; }
  .detalle-header { flex-direction: column; }
}
</style>
