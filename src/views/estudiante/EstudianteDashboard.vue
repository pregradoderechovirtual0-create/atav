<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { obtenerSesion, esperarAuth, leerNombreLocal } from '@/lib/session'
import { precargarCachesSolicitudesEstudiante } from '@/lib/precargarSolicitudesEstudiante'
import {
  type DashboardSolicitud,
  desdeFlexDoc,
  desdeHabDoc,
  desdeSupDoc,
  mergeDashboardSolicitudes,
  leerCacheDashboardSolicitudes,
  guardarCacheDashboardSolicitudes,
  construirDashboardDesdeCachesSidebar,
  leerCacheParcialesProximos,
  guardarCacheParcialesProximos,
} from '@/lib/dashboardSolicitudes'
import { primerosDosNombres } from '@/lib/nombreCorto'
import { useRefreshOnVisible } from '@/composables/useRefreshOnVisible'

const nombreEstudiante = ref(leerNombreLocal())

const nombreSaludo = computed(() => primerosDosNombres(nombreEstudiante.value))
const solicitudes = ref<DashboardSolicitud[]>([])
const proximosParciales = ref<any[]>(leerCacheParcialesProximos() ?? [])
const cargando = ref(solicitudes.value.length === 0)

const accionesRapidas = [
  {
    title: 'Flexibilización',
    desc: 'Cambio de fecha u hora de parcial',
    path: '/estudiante/flexibilidad',
    icon: 'calendar',
    color: '#10b981',
    bg: '#ecfdf5',
  },
  {
    title: 'Habilitación',
    desc: 'Habilitar una materia',
    path: '/estudiante/habilitaciones',
    icon: 'book',
    color: '#3b82f6',
    bg: '#eff6ff',
  },
  {
    title: 'Supletorio',
    desc: 'Examen supletorio',
    path: '/estudiante/supletorios',
    icon: 'file',
    color: '#f59e0b',
    bg: '#fffbeb',
  },
]

const horaDelDia = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
})

const fechaHoy = computed(() =>
  new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
)

const formatFecha = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  const meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(d)} ${meses[parseInt(m)]} ${y}`
}

const cargarFlexibilizaciones = async (uid: string): Promise<DashboardSolicitud[]> => {
  const q = query(collection(db, 'flexibilizaciones'), where('estudiante_id', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map(doc => desdeFlexDoc(doc.id, doc.data()))
}

const cargarHabilitaciones = async (uid: string): Promise<DashboardSolicitud[]> => {
  const q = query(collection(db, 'habilitaciones'), where('estudiante_id', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map(doc => desdeHabDoc(doc.id, doc.data()))
}

const cargarSupletorios = async (uid: string): Promise<DashboardSolicitud[]> => {
  const q = query(collection(db, 'supletorios'), where('estudiante_id', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map(doc => desdeSupDoc(doc.id, doc.data()))
}

const cargarParciales = async () => {
  try {
    const parSnap = await getDocs(collection(db, 'parciales'))
    const hoy = new Date()
    proximosParciales.value = parSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((p: any) => new Date(p.fecha + 'T00:00:00') >= hoy)
      .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
      .slice(0, 4) as any[]
    guardarCacheParcialesProximos(proximosParciales.value)
  } catch (_) {
    proximosParciales.value = []
  }
}

const aplicarCacheDashboard = (uid: string) => {
  const cached = leerCacheDashboardSolicitudes(uid)
    ?? construirDashboardDesdeCachesSidebar(uid)
  if (cached) {
    solicitudes.value = cached
    cargando.value = false
  }
}

const cargarSolicitudes = async (uid: string) => {
  const sinDatos = solicitudes.value.length === 0
  if (sinDatos) cargando.value = true
  try {
    const [flex, hab, sup] = await Promise.all([
      cargarFlexibilizaciones(uid),
      cargarHabilitaciones(uid),
      cargarSupletorios(uid),
      cargarParciales(),
    ])
    solicitudes.value = mergeDashboardSolicitudes([...flex, ...hab, ...sup])
    guardarCacheDashboardSolicitudes(uid, solicitudes.value)
  } catch (error) {
    console.error('Error cargando solicitudes:', error)
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  if (!nombreEstudiante.value) nombreEstudiante.value = leerNombreLocal()

  await esperarAuth()
  const uid = auth.currentUser?.uid
  if (uid) {
    aplicarCacheDashboard(uid)
    precargarCachesSolicitudesEstudiante(uid)
  }

  const sesion = await obtenerSesion()
  if (sesion?.nombre?.trim()) nombreEstudiante.value = sesion.nombre.trim()

  onAuthStateChanged(auth, (user) => {
    if (user) {
      aplicarCacheDashboard(user.uid)
      precargarCachesSolicitudesEstudiante(user.uid)
      cargarSolicitudes(user.uid)
    } else cargando.value = false
  })
})

const refrescarSiHaySesion = () => {
  const uid = auth.currentUser?.uid
  if (uid) cargarSolicitudes(uid)
}

useRefreshOnVisible(refrescarSiHaySesion)

const stats = computed(() => ({
  total: solicitudes.value.length,
  pendientes: solicitudes.value.filter(s => s.estado === 'Pendiente' || s.estado === 'En revisión').length,
  aprobadas: solicitudes.value.filter(s => s.estado === 'Aprobada').length,
  rechazadas: solicitudes.value.filter(s => s.estado === 'Rechazada').length,
}))

const solicitudesRecientes = computed(() => solicitudes.value.slice(0, 6))

const tipoIconClass = (tipo: string) => {
  if (tipo === 'flexibilizacion') return 'tipo-flex'
  if (tipo === 'habilitacion') return 'tipo-hab'
  return 'tipo-sup'
}

const tipoColorParcial: Record<string, string> = {
  habilitacion: '#3b82f6',
  supletorio: '#f59e0b',
  flexibilizacion: '#10b981',
}
</script>

<template>
  <div class="estudiante-dashboard">

    <section class="hero-welcome">
      <div class="hero-content">
        <p class="fecha-hoy">{{ fechaHoy }}</p>
        <h1 class="saludo">{{ horaDelDia }}<template v-if="nombreSaludo">, {{ nombreSaludo }}</template></h1>
        <p class="hero-subtitle">Tu espacio para trámites y seguimiento académico</p>

        <router-link to="/estudiante/flexibilidad" class="btn-hero-cta">
          <span class="btn-hero-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
          <span class="btn-hero-text">
            <span class="btn-hero-label">Solicitar flexibilización</span>
            <span class="btn-hero-hint">Cambia la fecha u hora de un parcial</span>
          </span>
          <span v-if="stats.pendientes > 0" class="btn-hero-badge">{{ stats.pendientes }} en proceso</span>
          <svg class="btn-hero-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </router-link>
      </div>
    </section>

    <section class="acciones-grid">
      <router-link
        v-for="accion in accionesRapidas"
        :key="accion.path"
        :to="accion.path"
        class="accion-card"
      >
        <div class="accion-icon" :style="{ background: accion.bg, color: accion.color }">
          <svg v-if="accion.icon === 'calendar'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <svg v-else-if="accion.icon === 'book'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="accion-text">
          <span class="accion-title">{{ accion.title }}</span>
          <span class="accion-desc">{{ accion.desc }}</span>
        </div>
        <svg class="accion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </router-link>
    </section>

    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-icon" style="background:#eff6ff; color:#3b82f6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
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
          <span v-if="stats.pendientes > 0" class="stat-tag stat-tag-warn">En proceso</span>
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

    <div class="info-bar">
      <div class="info-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </div>
      <span class="info-texto">
        Las <strong>flexibilizaciones</strong> se gestionan en la facultad. Las <strong>habilitaciones</strong> y <strong>supletorios</strong> quedan registrados para trazabilidad; la decisión final la toma Secretaría General.
      </span>
    </div>

    <div class="main-grid">
      <div class="card card-main" id="mis-solicitudes">
        <div class="card-header">
          <h2>Mis solicitudes</h2>
          <span v-if="solicitudes.length" class="header-count">{{ solicitudes.length }}</span>
        </div>

        <div v-if="cargando" class="loading-state">
          <div class="skeleton" v-for="i in 4" :key="i"/>
        </div>

        <div v-else-if="solicitudes.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p class="empty-title">Aún no tienes solicitudes</p>
          <p class="empty-desc">Usa las opciones de arriba para iniciar un trámite.</p>
        </div>

        <div v-else class="solicitudes-lista">
          <router-link
            v-for="sol in solicitudesRecientes"
            :key="`${sol.tipo}-${sol.id}`"
            :to="sol.ruta"
            class="solicitud-row"
          >
            <div :class="['sol-tipo-icon', tipoIconClass(sol.tipo)]">
              <svg v-if="sol.tipo === 'flexibilizacion'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <svg v-else-if="sol.tipo === 'habilitacion'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div class="sol-info">
              <p class="sol-nombre">{{ sol.curso }}</p>
              <p class="sol-meta">{{ sol.tipoLabel }} · {{ formatFecha(sol.fecha) }}<template v-if="sol.detalle"> · {{ sol.detalle }}</template></p>
              <p v-if="sol.motivoRechazo && sol.estado === 'Rechazada'" class="sol-rechazo">{{ sol.motivoRechazo }}</p>
            </div>
            <span :class="['badge', sol.estadoClass]">{{ sol.estado }}</span>
          </router-link>
        </div>

        <div v-if="solicitudes.length > 6" class="card-footer">
          <span>Mostrando 6 de {{ solicitudes.length }} solicitudes</span>
          <div class="footer-links">
            <router-link to="/estudiante/flexibilidad" class="ver-link">Flexibilización</router-link>
            <router-link to="/estudiante/habilitaciones" class="ver-link">Habilitación</router-link>
            <router-link to="/estudiante/supletorios" class="ver-link">Supletorio</router-link>
          </div>
        </div>
      </div>

      <div class="side-col">
        <div class="card">
          <div class="card-header">
            <h2>Próximos parciales</h2>
            <router-link to="/estudiante/calendario" class="ver-link">Calendario →</router-link>
          </div>

          <div v-if="proximosParciales.length === 0" class="empty-state pequeño">
            <p>Sin parciales próximos programados</p>
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
          <div class="card-header"><h2>Más herramientas</h2></div>
          <div class="accesos-grid">
            <router-link to="/estudiante/calendario" class="acceso">
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
            <router-link to="/estudiante/recursos" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <span>Recursos</span>
            </router-link>
            <router-link to="/estudiante/habilitaciones" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <span>Habilitación</span>
            </router-link>
            <router-link to="/estudiante/supletorios" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <span>Supletorio</span>
            </router-link>
            <router-link to="/estudiante/flexibilidad" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <span>Flexibilizar</span>
            </router-link>
            <router-link to="/perfil" class="acceso">
              <div class="acceso-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <span>Mi perfil</span>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.estudiante-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

/* Hero */
.hero-welcome {
  padding-bottom: 4px;
}

.hero-content {
  max-width: 640px;
  animation: hero-enter 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.fecha-hoy {
  font-size: 13px;
  color: var(--color-text-muted);
  text-transform: capitalize;
  margin-bottom: 8px;
}

.saludo {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 600;
  color: #000;
  line-height: 1.2;
  letter-spacing: -0.5px;
}

.hero-subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-top: 10px;
}

.btn-hero-cta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
  padding: 14px 18px;
  max-width: 440px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  text-decoration: none;
  transition: all var(--transition);
}

.btn-hero-cta:hover {
  border-color: var(--color-text-muted);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.btn-hero-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius);
  background: #10b981;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-hero-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.btn-hero-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.btn-hero-hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

.btn-hero-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  background: var(--color-warning-bg);
  color: var(--color-warning);
  white-space: nowrap;
}

.btn-hero-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform var(--transition);
}

.btn-hero-cta:hover .btn-hero-arrow {
  transform: translateX(3px);
  color: var(--color-text);
}

/* Acciones rápidas */
.acciones-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.accion-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: all var(--transition);
  box-shadow: var(--shadow-xs);
}

.accion-card:hover {
  border-color: var(--color-text-muted);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.accion-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.accion-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.accion-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.accion-desc {
  font-size: 12px;
  color: var(--color-text-muted);
}

.accion-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--shadow-xs);
  transition: box-shadow var(--transition), transform var(--transition);
}

.stat-card:hover {
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-tag {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-text-muted);
  background: var(--color-subtle);
  padding: 3px 8px;
  border-radius: 20px;
}

.stat-tag-warn {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -2px;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-muted);
}

.stat-pending .stat-value { color: var(--color-warning); }
.stat-approved .stat-value { color: var(--color-success); }
.stat-rejected .stat-value { color: var(--color-error); }

/* Info bar */
.info-bar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--color-subtle);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.info-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--color-border-light);
}

.info-texto strong { color: var(--color-text); }

/* Main grid */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
  align-items: start;
}

.side-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-xs);
}

.card-main {
  min-height: 280px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-border-light);
}

.card-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.header-count {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--color-primary);
  color: white;
}

.ver-link {
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 500;
  text-decoration: none;
}

.ver-link:hover { text-decoration: underline; }

.card-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-subtle);
}

.footer-links {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Solicitudes */
.solicitudes-lista { display: flex; flex-direction: column; }

.solicitud-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border-light);
  transition: background var(--transition);
  text-decoration: none;
}

.solicitud-row:last-child { border-bottom: none; }
.solicitud-row:hover { background: var(--color-subtle); }

.sol-tipo-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tipo-flex { background: #ecfdf5; color: #10b981; }
.tipo-hab { background: #eff6ff; color: #3b82f6; }
.tipo-sup { background: #fffbeb; color: #f59e0b; }

.sol-info { flex: 1; min-width: 0; }
.sol-nombre { font-size: 13px; font-weight: 500; color: var(--color-text); }
.sol-meta { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }

.sol-rechazo {
  font-size: 11px;
  color: var(--color-error);
  margin-top: 4px;
  line-height: 1.35;
}

.badge {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge.pending  { background: var(--color-warning-bg); color: var(--color-warning); }
.badge.approved { background: var(--color-success-bg); color: var(--color-success); }
.badge.review   { background: var(--color-info-bg); color: var(--color-info); }
.badge.rejected { background: var(--color-error-bg); color: var(--color-error); }

/* Parciales */
.parciales-lista { display: flex; flex-direction: column; }

.parcial-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-light);
}

.parcial-row:last-child { border-bottom: none; }

.parcial-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.parcial-materia { font-size: 13px; font-weight: 500; color: var(--color-text); }
.parcial-meta { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }

/* Accesos */
.accesos-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 16px;
}

.acceso {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  transition: all var(--transition);
  text-align: center;
  text-decoration: none;
}

.acceso:hover {
  background: var(--color-subtle);
  color: var(--color-text);
  border-color: var(--color-border);
}

.acceso-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius);
  background: var(--color-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}

.acceso:hover .acceso-icon {
  background: var(--color-primary);
  color: white;
}

.acceso span { font-size: 11px; font-weight: 500; }

/* Loading & empty */
.loading-state { display: flex; flex-direction: column; }

.skeleton {
  height: 60px;
  margin: 0 20px;
  background: linear-gradient(90deg, var(--color-border-light) 25%, var(--color-border) 50%, var(--color-border-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-bottom: 1px solid var(--color-border-light);
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-state.pequeño { padding: 20px; font-size: 13px; color: var(--color-text-muted); }

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-subtle);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.empty-desc {
  font-size: 13px;
  color: var(--color-text-muted);
}

@keyframes hero-enter {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 1024px) {
  .acciones-grid { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .main-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .btn-hero-cta { max-width: 100%; }
  .btn-hero-badge { display: none; }
  .accesos-grid { grid-template-columns: repeat(2, 1fr); }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .stat-card { padding: 16px; }
  .stat-value { font-size: 28px; }
}

@media (max-width: 400px) {
  .stats-grid { grid-template-columns: 1fr; }
}
</style>
