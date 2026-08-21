<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchMaterias } from '@/lib/dominio/materias'
import { fetchSolicitudesDirector } from '@/lib/director/directorSolicitudesAggregate'
import { computarStatsDirector, TIPOS_TRAZABILIDAD } from '@/lib/director/directorStats'
import TableDetailModal from '@/componentes/modales/TableDetailModal.vue'
import { buildDetailFields } from '@/lib/nucleo/tableDetail'

const loading = ref(true)
const solicitudes = ref<any[]>([])
const periodoSeleccionado = ref('todos')

const detalleVisible = ref(false)
const detalleTitle = ref('')
const detalleSubtitle = ref('')
const detalleFields = ref<{ label: string; value: string; href?: string }[]>([])

const verDetalleSolicitud = (s: any) => {
  detalleTitle.value = s.nombre || 'Solicitud'
  detalleSubtitle.value = tipoLabel[s.tipo] || s.tipo || ''
  detalleFields.value = buildDetailFields(
    { ...s, tipoLabel: tipoLabel[s.tipo] || s.tipo, fecha: formatFecha(s.creadoEn) },
    [
      { key: 'nombre', label: 'Nombre' },
      { key: 'cedula', label: 'Cédula' },
      { key: 'tipoLabel', label: 'Tipo' },
      { key: 'materia', label: 'Materia / curso' },
      { key: 'motivo', label: 'Motivo / detalle' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'pdf_url', label: 'Soporte PDF', hrefKey: 'pdf_url' },
    ],
  )
  detalleVisible.value = true
}

const mesesNombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const tipoLabel: Record<string, string> = {
  flexibilizacion: 'Flexibilización',
  supletorio: 'Supletorio',
  habilitacion: 'Habilitación',
  inasistencia: 'Inasistencia docente',
}

const tipoColor: Record<string, string> = {
  flexibilizacion: '#3b82f6',
  supletorio: '#f59e0b',
  habilitacion: '#10b981',
  inasistencia: '#8b5cf6',
}

// Tipos que la facultad solo registra/traza; la decisión la toma Secretaría General

const formatFecha = (ts: any) => {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
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

    solicitudes.value = await fetchSolicitudesDirector(materias)
  } catch (e) {
    console.error(e)
  }
  loading.value = false
}

const solicitudesFiltradas = computed(() => {
  if (periodoSeleccionado.value === 'todos') return solicitudes.value
  const ahora = new Date()
  const dias = periodoSeleccionado.value === '7d' ? 7 : periodoSeleccionado.value === '30d' ? 30 : 90
  const desde = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000)
  return solicitudes.value.filter(s => {
    const f = s.creadoEn?.toDate ? s.creadoEn.toDate() : new Date(s.creadoEn)
    return f >= desde
  })
})

const gestionables = computed(() =>
  solicitudesFiltradas.value.filter(s => !TIPOS_TRAZABILIDAD.includes(s.tipo))
)

const stats = computed(() => {
  const resumen = computarStatsDirector(solicitudesFiltradas.value)
  return {
    total: resumen.total,
    pendientes: resumen.pendientes,
    aprobadas: resumen.aprobadas,
    rechazadas: resumen.rechazadas,
  }
})

const tasaAprobacion = computed(() => {
  const resueltas = stats.value.aprobadas + stats.value.rechazadas
  if (!resueltas) return 0
  return Math.round((stats.value.aprobadas / resueltas) * 100)
})

const trazabilidadStats = computed(() => computarStatsDirector(solicitudesFiltradas.value).trazabilidad)

// Por tipo: incluye las 4 categorías (vista informativa de volumen total)
const porTipo = computed(() => {
  const map: Record<string, number> = {}
  solicitudesFiltradas.value.forEach(s => {
    const t = s.tipo || 'otro'
    map[t] = (map[t] || 0) + 1
  })
  return Object.entries(map)
    .map(([tipo, count]) => ({ tipo, count, label: tipoLabel[tipo] || tipo, color: tipoColor[tipo] || '#94a3b8' }))
    .sort((a, b) => b.count - a.count)
})

// Por mes: incluye las 4 categorías (volumen total de trámites del programa)
const porMes = computed(() => {
  const ahora = new Date()
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (5 - i), 1)
    return { mes: d.getMonth(), anio: d.getFullYear(), label: mesesNombres[d.getMonth()], count: 0 }
  })
  solicitudesFiltradas.value.forEach(s => {
    const f = s.creadoEn?.toDate ? s.creadoEn.toDate() : null
    if (!f) return
    const entry = meses.find(m => m.mes === f.getMonth() && m.anio === f.getFullYear())
    if (entry) entry.count++
  })
  return meses
})

const maxMes = computed(() => Math.max(...porMes.value.map(m => m.count), 1))

const maxTipo = computed(() => Math.max(...porTipo.value.map(t => t.count), 1))

// Tabla de soporte PDF: solo tiene sentido para lo gestionable (hab/sup no manejan PDF)
const conPDF = computed(() => solicitudesFiltradas.value.filter(s => s.pdf_url))

const estadoClass = (estado: string) => {
  if (estado === 'Aprobada') return 'badge-aprobada'
  if (estado === 'Rechazada') return 'badge-rechazada'
  if (estado === 'Registrado') return 'badge-registrado'
  return 'badge-pendiente'
}

const exportarCSV = () => {
  const headers = ['Nombre', 'Tipo', 'Materia', 'Estado', 'Fecha', 'PDF']
  const rows = solicitudesFiltradas.value.map(s => [
    s.nombre || '—',
    tipoLabel[s.tipo] || s.tipo || '—',
    s.materia || '—',
    s.estado || '—',
    formatFecha(s.creadoEn),
    s.pdf_url || '',
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte_solicitudes_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(cargarDatos)
</script>

<template>
  <div class="reportes-page">

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="periodo-tabs">
        <button
          v-for="p in [['todos','Todo'], ['7d','7 días'], ['30d','30 días'], ['90d','90 días']]"
          :key="p[0]"
          :class="['periodo-tab', { active: periodoSeleccionado === p[0] }]"
          @click="periodoSeleccionado = p[0]"
        >
          {{ p[1] }}
        </button>
      </div>
      <button class="btn-export" @click="exportarCSV">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Exportar CSV
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>Cargando reportes...</span>
    </div>

    <template v-else>

      <!-- Stats: solo lo que la facultad gestiona y decide -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ stats.total }}</p>
            <p class="stat-label">Total solicitudes</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ stats.pendientes }}</p>
            <p class="stat-label">Pendientes</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ stats.aprobadas }}</p>
            <p class="stat-label">Aprobadas</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ stats.rechazadas }}</p>
            <p class="stat-label">Rechazadas</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ tasaAprobacion }}%</p>
            <p class="stat-label">Tasa aprobación</p>
          </div>
        </div>
      </div>

      <!-- Trazabilidad: habilitaciones y supletorios (no requieren decisión de la facultad) -->
      <div class="trazabilidad-bar">
        <div class="trazabilidad-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </div>
        <span class="trazabilidad-texto">
          <strong>{{ trazabilidadStats.total }}</strong> trámites de trazabilidad en este período
          ({{ trazabilidadStats.habilitaciones }} habilitaciones, {{ trazabilidadStats.supletorios }} supletorios)
          — la facultad solo entrega el formato, la decisión la toma Secretaría General.
        </span>
      </div>

      <!-- Gráficas -->
      <div class="charts-grid">

        <!-- Solicitudes por mes -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Solicitudes por mes</h2>
            <span class="card-badge">Últimos 6 meses</span>
          </div>
          <div class="bar-chart">
            <div v-for="m in porMes" :key="m.label" class="bar-item">
              <div class="bar-track">
                <div
                  class="bar-fill blue-fill"
                  :style="{ height: `${(m.count / maxMes) * 100}%` }"
                ></div>
              </div>
              <span class="bar-count">{{ m.count }}</span>
              <span class="bar-label">{{ m.label }}</span>
            </div>
          </div>
        </div>

        <!-- Por tipo -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Por tipo de solicitud</h2>
            <span class="card-badge">{{ porTipo.length }} tipos</span>
          </div>
          <div class="tipo-list">
            <div v-if="porTipo.length === 0" class="empty-msg">Sin datos</div>
            <div v-for="t in porTipo" :key="t.tipo" class="tipo-item">
              <div class="tipo-header">
                <div class="tipo-dot" :style="{ background: t.color }"></div>
                <span class="tipo-label">{{ t.label }}</span>
                <span class="tipo-count">{{ t.count }}</span>
              </div>
              <div class="tipo-track">
                <div
                  class="tipo-fill"
                  :style="{ width: `${(t.count / maxTipo) * 100}%`, background: t.color }"
                ></div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Tabla solicitudes con PDF -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Solicitudes con soporte PDF</h2>
          <span class="card-badge">{{ conPDF.length }} archivos</span>
        </div>

        <div v-if="conPDF.length === 0" class="empty-msg" style="padding: 24px;">
          No hay solicitudes con PDF adjunto
        </div>

        <div v-else class="table-wrapper table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Cédula</th>
                <th>Tipo</th>
                <th>Materia</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Soporte</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in conPDF"
                :key="s.id"
                class="row-clickable"
                @click="verDetalleSolicitud(s)"
              >
                <td class="td-nombre">{{ s.nombre || '—' }}</td>
                <td>{{ s.cedula || '—' }}</td>
                <td>{{ tipoLabel[s.tipo] || s.tipo || '—' }}</td>
                <td class="td-materia">{{ s.materia || '—' }}</td>
                <td>
                  <span :class="['status-badge', estadoClass(s.estado)]">
                    {{ s.estado }}
                  </span>
                </td>
                <td>{{ formatFecha(s.creadoEn) }}</td>
                <td @click.stop>
                  <a :href="s.pdf_url" target="_blank" class="pdf-link" @click.stop>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    Ver PDF
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </template>

    <TableDetailModal
      :open="detalleVisible"
      :title="detalleTitle"
      :subtitle="detalleSubtitle"
      :fields="detalleFields"
      @close="detalleVisible = false"
    />
  </div>
</template>

<style scoped>
.reportes-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Toolbar ── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.periodo-tabs { display: flex; gap: 6px; }

.periodo-tab {
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition);
}

.periodo-tab:hover { border-color: var(--color-text-muted); color: var(--color-text); }
.periodo-tab.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition);
}

.btn-export:hover { background: var(--color-background); }

/* ── Loading ── */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Stats ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon.blue { background: #eff6ff; color: #3b82f6; }
.stat-icon.orange { background: #fff7ed; color: #f59e0b; }
.stat-icon.green { background: #f0fdf4; color: #10b981; }
.stat-icon.red { background: #fef2f2; color: #ef4444; }
.stat-icon.purple { background: #f5f3ff; color: #8b5cf6; }

.stat-content { display: flex; flex-direction: column; gap: 2px; }

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ── Trazabilidad bar ── */
.trazabilidad-bar {
  display: flex; align-items: center; gap: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.trazabilidad-icon {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--color-background);
  color: var(--color-text-muted);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.trazabilidad-texto strong { color: var(--color-text); }

/* ── Charts ── */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-border-light);
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.card-badge {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-background);
  border: 1px solid var(--color-border-light);
  padding: 3px 10px;
  border-radius: 99px;
}

/* ── Bar chart ── */
.bar-chart {
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  gap: 8px;
  padding: 24px 20px 16px;
  height: 200px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.bar-track {
  flex: 1;
  width: 100%;
  max-width: 36px;
  background: var(--color-border-light);
  border-radius: 6px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  min-height: 4px;
}

.bar-fill {
  width: 100%;
  border-radius: 6px;
  transition: height 0.4s ease;
  min-height: 4px;
}

.blue-fill { background: var(--color-primary); }

.bar-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.bar-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* ── Tipo list ── */
.tipo-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.tipo-item { display: flex; flex-direction: column; gap: 6px; }

.tipo-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tipo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tipo-label {
  font-size: 13px;
  color: var(--color-text);
  flex: 1;
}

.tipo-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.tipo-track {
  height: 6px;
  background: var(--color-border-light);
  border-radius: 99px;
  overflow: hidden;
}

.tipo-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease;
}

/* ── Table ── */
.table-wrapper { overflow-x: auto; }

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}

.data-table td {
  padding: 14px 16px;
  font-size: 13px;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}

.data-table tbody tr:hover { background: var(--color-background); }
.data-table tbody tr.row-clickable { cursor: pointer; }
.data-table tbody tr.row-clickable:hover { background: var(--color-subtle); }
.data-table tbody tr:last-child td { border-bottom: none; }

.td-nombre { font-weight: 500; }
.td-materia {
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Badges ── */
.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.badge-aprobada { background: #f0fdf4; color: #16a34a; }
.badge-rechazada { background: #fef2f2; color: #dc2626; }
.badge-pendiente { background: #fef3c7; color: #d97706; }
.badge-registrado { background: #eff6ff; color: #2563eb; }

/* ── PDF link ── */
.pdf-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  transition: all var(--transition);
}

.pdf-link:hover {
  background: var(--color-info-bg);
  border-color: var(--color-primary);
}

/* ── Empty ── */
.empty-msg {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 32px;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
  .charts-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .toolbar { flex-direction: column; align-items: flex-start; }
}
</style>