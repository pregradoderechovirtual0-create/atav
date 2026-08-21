<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { fetchSolicitudesDocente, type SolicitudDocente } from '@/lib/solicitudes/docenteSolicitudes'

const activeFilter = ref('todas')
const solicitudes = ref<SolicitudDocente[]>([])
const cargando = ref(true)

const formatFecha = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const formatRango = (inicio: string, fin: string) => {
  if (!inicio) return '—'
  if (!fin || fin === inicio) return formatFecha(inicio)
  return `${formatFecha(inicio)} – ${formatFecha(fin)}`
}

const cargar = async (uid: string) => {
  cargando.value = true
  try {
    solicitudes.value = await fetchSolicitudesDocente(uid)
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) cargar(user.uid)
    else cargando.value = false
  })
})

const solicitudesFiltradas = computed(() => {
  if (activeFilter.value === 'todas') return solicitudes.value
  if (activeFilter.value === 'pendientes') {
    return solicitudes.value.filter(s => s.estadoLabel === 'Pendiente' || s.estadoLabel === 'En revisión')
  }
  if (activeFilter.value === 'aprobadas') {
    return solicitudes.value.filter(s => s.estadoLabel === 'Aprobada' || s.estadoLabel === 'Cerrada')
  }
  if (activeFilter.value === 'rechazadas') {
    return solicitudes.value.filter(s => s.estadoLabel === 'Rechazada')
  }
  return solicitudes.value
})

const filtros = computed(() => [
  { id: 'todas', label: 'Todas', count: solicitudes.value.length },
  {
    id: 'pendientes',
    label: 'Pendientes',
    count: solicitudes.value.filter(s => s.estadoLabel === 'Pendiente' || s.estadoLabel === 'En revisión').length,
  },
  {
    id: 'aprobadas',
    label: 'Aprobadas',
    count: solicitudes.value.filter(s => s.estadoLabel === 'Aprobada' || s.estadoLabel === 'Cerrada').length,
  },
  {
    id: 'rechazadas',
    label: 'Rechazadas',
    count: solicitudes.value.filter(s => s.estadoLabel === 'Rechazada').length,
  },
])
</script>

<template>
  <div class="mis-solicitudes role-page">
    <div class="toolbar">
      <div class="filter-tabs">
        <button
          v-for="filtro in filtros"
          :key="filtro.id"
          :class="['filter-tab', { active: activeFilter === filtro.id }]"
          @click="activeFilter = filtro.id"
        >
          {{ filtro.label }}
          <span class="filter-count">{{ filtro.count }}</span>
        </button>
      </div>
      <router-link to="/docente/crear-solicitud" class="btn btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nueva solicitud
      </router-link>
    </div>

    <p v-if="cargando" class="empty-state">Cargando solicitudes...</p>

    <div v-else-if="!solicitudesFiltradas.length" class="empty-state">
      No hay solicitudes en este filtro.
    </div>

    <div v-else class="solicitudes-list">
      <router-link
        v-for="sol in solicitudesFiltradas"
        :key="sol.id"
        :to="`/docente/solicitud/${sol.id}`"
        class="solicitud-card"
      >
        <div class="solicitud-main">
          <div class="solicitud-left">
            <div class="solicitud-meta">
              <span class="tipo-chip">{{ sol.tipoLabel }}</span>
              <span class="solicitud-id">{{ sol.id.slice(0, 8).toUpperCase() }}</span>
            </div>
            <span class="solicitud-materia">{{ sol.materia }}</span>
            <span class="solicitud-rango">{{ formatRango(sol.fecha_inicio, sol.fecha_fin) }}</span>
            <span class="solicitud-repro">{{ sol.reprogramacionTexto }}</span>
          </div>
          <div class="solicitud-right">
            <span class="solicitud-fecha">{{ formatFecha(sol.fecha) }}</span>
            <span :class="['estado-chip', sol.estadoClass]">{{ sol.estadoLabel }}</span>
          </div>
        </div>
        <div v-if="sol.motivo_rechazo && sol.estadoLabel === 'Rechazada'" class="motivo-rechazo">
          <span class="motivo-rechazo-label">Motivo de rechazo</span>
          <p class="motivo-rechazo-text">{{ sol.motivo_rechazo }}</p>
        </div>
      </router-link>
    </div>

    <div v-if="!cargando && solicitudesFiltradas.length" class="pagination">
      <span class="pagination-info">{{ solicitudesFiltradas.length }} solicitudes</span>
    </div>
  </div>
</template>

<style scoped>
.mis-solicitudes { display: flex; flex-direction: column; gap: 20px; }

.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }

.filter-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
  background: var(--color-surface); color: var(--color-text-secondary);
  border: 1px solid var(--color-border); cursor: pointer; transition: all var(--transition);
}
.filter-tab:hover { border-color: var(--color-text-muted); color: var(--color-text); }
.filter-tab.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.filter-count { font-size: 11px; padding: 2px 6px; border-radius: 10px; background: rgba(255,255,255,0.2); }
.filter-tab:not(.active) .filter-count { background: var(--color-background); color: var(--color-text-muted); }

.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: var(--radius);
  font-size: 13px; font-weight: 500; text-decoration: none; border: none; cursor: pointer;
}
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover { background: var(--color-primary-light); }

.solicitudes-list { display: flex; flex-direction: column; gap: 8px; }

.solicitud-card {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px; background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-lg);
  transition: border-color var(--transition);
}
.solicitud-card:hover { border-color: var(--color-accent); }

.solicitud-main { display: flex; justify-content: space-between; gap: 16px; width: 100%; }
.solicitud-left { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.solicitud-meta { display: flex; align-items: center; gap: 8px; }
.tipo-chip {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
  background: var(--color-info-bg); color: var(--color-accent); padding: 2px 7px; border-radius: 4px;
}
.solicitud-id { font-size: 11px; font-weight: 600; color: var(--color-text-muted); }
.solicitud-materia { font-size: 14px; font-weight: 600; color: var(--color-text); }
.solicitud-rango, .solicitud-repro { font-size: 12px; color: var(--color-text-secondary); }
.solicitud-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.solicitud-fecha { font-size: 12px; color: var(--color-text-muted); }

.estado-chip { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 99px; }
.estado-pendiente  { background: #fef3c7; color: #d97706; }
.estado-aprobada   { background: #f0fdf4; color: #16a34a; }
.estado-rechazada  { background: #fee2e2; color: #dc2626; }
.estado-revision   { background: #eff6ff; color: #2563eb; }
.estado-cerrada    { background: var(--color-border-light); color: var(--color-text-muted); }

.motivo-rechazo {
  width: 100%; padding: 10px 12px; background: #fef2f2;
  border: 1px solid #fecaca; border-radius: 8px;
}
.motivo-rechazo-label {
  display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.4px; color: #b91c1c; margin-bottom: 4px;
}
.motivo-rechazo-text { margin: 0; font-size: 13px; color: #dc2626; line-height: 1.5; }

.empty-state { font-size: 13px; color: var(--color-text-muted); text-align: center; padding: 32px 0; }
.pagination-info { font-size: 13px; color: var(--color-text-muted); }

@media (max-width: 768px) {
  .solicitud-main { flex-direction: column; }
  .solicitud-right { flex-direction: row; align-items: center; }
}
</style>
