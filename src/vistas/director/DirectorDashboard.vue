<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { obtenerSesion } from '@/lib/autenticacion/session'
import { fetchMaterias } from '@/lib/dominio/materias'
import { fetchSolicitudesDirector, type SolicitudDirector } from '@/lib/director/directorSolicitudesAggregate'
import { computarStatsDirector, TIPOS_TRAZABILIDAD } from '@/lib/director/directorStats'
import { primerosDosNombres } from '@/lib/nucleo/nombreCorto'
import { useRefreshOnVisible } from '@/composables/useRefreshOnVisible'

const nombreDirectora = ref('Directora')

const nombreSaludo = computed(() => primerosDosNombres(nombreDirectora.value) || 'Directora')

const stats = ref({ total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0 })
const trazabilidad = ref({ total: 0, habilitaciones: 0, supletorios: 0 })
const solicitudesRecientes = ref<any[]>([])
const proximosParciales = ref<any[]>([])
const loading = ref(true)

const horaDelDia = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
})

const fechaHoy = computed(() =>
  new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
)

const mapEstadoLista = (estado: string) => estado

const estadoClassFromLabel: Record<string, string> = {
  Pendiente: 'pending',
  Aprobada: 'approved',
  Rechazada: 'rejected',
  'En revisión': 'review',
}

const tipoLabel: Record<string, string> = {
  habilitacion: 'Habilitación',
  supletorio: 'Supletorio',
  flexibilizacion: 'Flexibilización',
  inasistencia: 'Inasistencia docente',
}

const formatFecha = (ts: unknown) => {
  if (!ts) return ''
  const d =
    typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as string | number)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const cargarDatos = async () => {
  loading.value = true
  try {
    let materias: Awaited<ReturnType<typeof fetchMaterias>> = []
    try {
      materias = await fetchMaterias()
    } catch (e) {
      console.error('Error cargando materias:', e)
    }

    const todas = await fetchSolicitudesDirector(materias)
    const resumen = computarStatsDirector(todas)

    stats.value.total = resumen.total
    stats.value.pendientes = resumen.pendientes
    stats.value.aprobadas = resumen.aprobadas
    stats.value.rechazadas = resumen.rechazadas
    trazabilidad.value = resumen.trazabilidad

    solicitudesRecientes.value = todas.slice(0, 5).map((s: SolicitudDirector) => {
      const esTrazabilidad = TIPOS_TRAZABILIDAD.includes(s.tipo as typeof TIPOS_TRAZABILIDAD[number])
      const nombre = s.nombre || 'Usuario'
      return {
        id: s.id,
        nombre,
        tipo: tipoLabel[s.tipo] || s.tipo || '—',
        fecha: formatFecha(s.creadoEn),
        estado: esTrazabilidad ? 'Registrado' : mapEstadoLista(s.estado),
        estadoClass: esTrazabilidad
          ? 'muted'
          : (estadoClassFromLabel[s.estado] || 'pending'),
        esTrazabilidad,
        iniciales: nombre.charAt(0).toUpperCase(),
      }
    })

    try {
      const parSnap = await getDocs(collection(db, 'parciales'))
      const hoy = new Date()
      proximosParciales.value = parSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((p: any) => new Date(p.fecha + 'T00:00:00') >= hoy)
        .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
        .slice(0, 3) as any[]
    } catch (_) {}
  } catch (e) {
    console.error(e)
  }
  loading.value = false
}

const tipoColorParcial: Record<string, string> = {
  habilitacion: '#3b82f6',
  supletorio: '#f59e0b',
  flexibilizacion: '#10b981'
}

onMounted(async () => {
  const sesion = await obtenerSesion()
  if (sesion?.nombre) nombreDirectora.value = sesion.nombre
  cargarDatos()
})

useRefreshOnVisible(cargarDatos)
</script>

<template>
  <div class="director-dashboard">
    <section class="hero-welcome">
      <div class="hero-content">
        <p class="fecha-hoy">{{ fechaHoy }}</p>
        <h1 class="saludo">{{ horaDelDia }}, {{ nombreSaludo }}</h1>
        <p class="hero-subtitle">Panel de gestión · Programa de Derecho</p>

        <router-link to="/director/solicitudes" class="btn-ver-solicitudes">
          <span class="btn-ver-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          </span>
          <span class="btn-ver-text">
            <span class="btn-ver-label">Ver solicitudes</span>
            <span class="btn-ver-hint">Gestiona trámites y ausentismos del programa</span>
          </span>
          <span v-if="stats.pendientes > 0" class="btn-ver-badge">{{ stats.pendientes }} pendientes</span>
          <svg class="btn-ver-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </router-link>
      </div>
    </section>

    <section class="stats-grid">
      <div class="stat-card stat-total">
        <div class="stat-top">
          <div class="stat-icon" style="background:#eff6ff; color:#3b82f6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span class="stat-tag">Todo el programa</span>
        </div>
        <p class="stat-value">{{ stats.total }}</p>
        <p class="stat-label">Total solicitudes</p>
      </div>
      <div class="stat-card stat-pending">
        <div class="stat-top">
          <div class="stat-icon" style="background:#fffbeb; color:#f59e0b">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <span class="stat-tag stat-tag-warn">Requieren acción</span>
        </div>
        <p class="stat-value">{{ stats.pendientes }}</p>
        <p class="stat-label">Pendientes</p>
      </div>
      <div class="stat-card stat-approved">
        <div class="stat-top">
          <div class="stat-icon" style="background:#ecfdf5; color:#10b981">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
        <p class="stat-value">{{ stats.aprobadas }}</p>
        <p class="stat-label">Aprobadas</p>
      </div>
      <div class="stat-card stat-rejected">
        <div class="stat-top">
          <div class="stat-icon" style="background:#fef2f2; color:#ef4444">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
        </div>
        <p class="stat-value">{{ stats.rechazadas }}</p>
        <p class="stat-label">Rechazadas</p>
      </div>
    </section>

    <div class="trazabilidad-bar">
      <div class="trazabilidad-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      </div>
      <span class="trazabilidad-texto">
        <strong>{{ trazabilidad.total }}</strong> trámites de trazabilidad
        ({{ trazabilidad.habilitaciones }} habilitaciones, {{ trazabilidad.supletorios }} supletorios) — solo registro; la decisión la toma Secretaría General.
      </span>
    </div>

    <div class="main-grid">
      <div class="card card-main">
        <div class="card-header">
          <h2>Solicitudes recientes</h2>
          <router-link to="/director/solicitudes" class="ver-link">Ver todas →</router-link>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="skeleton" v-for="i in 4" :key="i"/>
        </div>

        <div v-else-if="solicitudesRecientes.length === 0" class="empty-state">
          <p>No hay solicitudes aún</p>
        </div>

        <div v-else class="solicitudes-lista">
          <router-link
            v-for="sol in solicitudesRecientes"
            :key="sol.id"
            to="/director/solicitudes"
            class="solicitud-row"
          >
            <div class="sol-avatar">{{ sol.iniciales }}</div>
            <div class="sol-info">
              <p class="sol-nombre">{{ sol.nombre }}</p>
              <p class="sol-tipo">{{ sol.tipo }} · {{ sol.fecha }}</p>
            </div>
            <span :class="['badge', sol.estadoClass]">{{ sol.estado }}</span>
          </router-link>
        </div>
      </div>

      <div class="side-col">
        <div class="card">
          <div class="card-header">
            <h2>Próximos parciales</h2>
            <router-link to="/director/calendario" class="ver-link">Ver calendario →</router-link>
          </div>

          <div v-if="proximosParciales.length === 0" class="empty-state pequeño">
            <p>Sin parciales próximos</p>
          </div>

          <div v-else class="parciales-lista">
            <div v-for="p in proximosParciales" :key="p.id" class="parcial-row">
              <div class="parcial-dot" :style="{ background: tipoColorParcial[p.tipo] || '#94a3b8' }"/>
              <div class="parcial-info">
                <p class="parcial-materia">{{ p.materia }}</p>
                <p class="parcial-meta">{{ p.fecha }} · {{ p.hora }} · {{ p.aula }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Accesos rápidos</h2>
          </div>
          <div class="accesos-grid">
            <router-link to="/director/usuarios" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <span>Usuarios</span>
            </router-link>
            <router-link to="/director/materias" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <span>Materias</span>
            </router-link>
            <router-link to="/director/calendario" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <span>Calendario</span>
            </router-link>
            <router-link to="/director/reportes" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <span>Reportes</span>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.director-dashboard { display: flex; flex-direction: column; gap: 28px; }
.hero-welcome { padding-bottom: 4px; }
.hero-content { max-width: 640px; animation: hero-enter 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
.fecha-hoy { font-size: 13px; color: var(--color-text-muted); margin-bottom: 8px; text-transform: capitalize; animation: hero-enter 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both; }
.saludo { font-size: clamp(28px, 4vw, 40px); font-weight: 600; color: #000; line-height: 1.2; letter-spacing: -0.5px; animation: hero-enter 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
.hero-subtitle { font-size: 14px; color: var(--color-text-muted); margin-top: 10px; animation: hero-enter 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both; }
.btn-ver-solicitudes { display: flex; align-items: center; gap: 14px; margin-top: 20px; padding: 14px 18px; max-width: 420px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); text-decoration: none; box-shadow: var(--shadow-xs); transition: all var(--transition); animation: hero-enter 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both; }
.btn-ver-solicitudes:hover { border-color: var(--color-text-muted); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.btn-ver-icon { width: 44px; height: 44px; border-radius: var(--radius); background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.btn-ver-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.btn-ver-label { font-size: 14px; font-weight: 600; color: var(--color-text); }
.btn-ver-hint { font-size: 12px; color: var(--color-text-muted); }
.btn-ver-badge { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; background: var(--color-warning-bg); color: var(--color-warning); flex-shrink: 0; white-space: nowrap; }
.btn-ver-arrow { color: var(--color-text-muted); flex-shrink: 0; transition: transform var(--transition); }
.btn-ver-solicitudes:hover .btn-ver-arrow { transform: translateX(3px); color: var(--color-text); }
@keyframes hero-enter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-xs); transition: box-shadow var(--transition), transform var(--transition); }
.stat-card:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.stat-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.stat-icon { width: 40px; height: 40px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-tag { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: var(--color-subtle); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.stat-tag-warn { background: var(--color-warning-bg); color: var(--color-warning); }
.stat-value { font-size: 36px; font-weight: 700; color: var(--color-text); line-height: 1; letter-spacing: -2px; }
.stat-label { font-size: 13px; color: var(--color-text-muted); }
.stat-pending .stat-value { color: var(--color-warning); }
.stat-approved .stat-value { color: var(--color-success); }
.stat-rejected .stat-value { color: var(--color-error); }
.trazabilidad-bar { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--color-subtle); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); font-size: 13px; color: var(--color-text-secondary); line-height: 1.45; }
.trazabilidad-icon { width: 32px; height: 32px; border-radius: 50%; background: var(--color-surface); border: 1px solid var(--color-border-light); display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); flex-shrink: 0; }
.trazabilidad-texto strong { color: var(--color-text); }
.main-grid { display: grid; grid-template-columns: 1fr 360px; gap: 20px; align-items: start; }
.side-col { display: flex; flex-direction: column; gap: 20px; }
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-xs); overflow: hidden; }
.card-main { min-height: 320px; }
.card-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--color-border-light); }
.card-header h2 { font-size: 14px; font-weight: 600; color: var(--color-text); }
.ver-link { font-size: 12px; font-weight: 500; color: var(--color-accent); }
.ver-link:hover { text-decoration: underline; }
.solicitudes-lista { display: flex; flex-direction: column; }
.solicitud-row { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--color-border-light); transition: background var(--transition); text-decoration: none; color: inherit; }
.solicitud-row:last-child { border-bottom: none; }
.solicitud-row:hover { background: var(--color-subtle); }
.sol-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; }
.sol-info { flex: 1; min-width: 0; }
.sol-nombre { font-size: 13px; font-weight: 500; color: var(--color-text); }
.sol-tipo { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.badge { font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 20px; flex-shrink: 0; white-space: nowrap; }
.badge.pending { background: var(--color-warning-bg); color: var(--color-warning); }
.badge.approved { background: var(--color-success-bg); color: var(--color-success); }
.badge.review { background: var(--color-info-bg); color: var(--color-info); }
.badge.rejected { background: var(--color-error-bg); color: var(--color-error); }
.badge.muted { background: var(--color-border-light); color: var(--color-text-muted); }
.parciales-lista { display: flex; flex-direction: column; }
.parcial-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--color-border-light); }
.parcial-row:last-child { border-bottom: none; }
.parcial-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.parcial-materia { font-size: 13px; font-weight: 500; color: var(--color-text); }
.parcial-meta { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.accesos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 16px; }
.acceso { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 8px; border-radius: var(--radius); border: 1px solid var(--color-border-light); background: var(--color-surface); color: var(--color-text-secondary); text-align: center; transition: all var(--transition); text-decoration: none; }
.acceso:hover { background: var(--color-subtle); border-color: var(--color-border); color: var(--color-text); }
.acceso-icon { width: 38px; height: 38px; border-radius: var(--radius); background: var(--color-subtle); display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
.acceso:hover .acceso-icon { background: var(--color-primary); color: white; }
.acceso span { font-size: 11px; font-weight: 500; }
.loading-state { display: flex; flex-direction: column; }
.skeleton { height: 60px; margin: 0 20px; border-bottom: 1px solid var(--color-border-light); background: linear-gradient(90deg, var(--color-border-light) 25%, var(--color-border) 50%, var(--color-border-light) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.empty-state { text-align: center; padding: 40px 20px; color: var(--color-text-muted); font-size: 13px; }
.empty-state.pequeño { padding: 20px; }
@media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .main-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .btn-ver-solicitudes { max-width: 100%; } .btn-ver-badge { display: none; } .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } .stat-card { padding: 16px; } .stat-value { font-size: 28px; } }
@media (max-width: 400px) { .stats-grid { grid-template-columns: 1fr; } }
</style>
