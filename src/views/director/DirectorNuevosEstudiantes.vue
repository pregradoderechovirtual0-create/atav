<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { dialog } from '@/lib/dialog'

const search = ref('')
const selected = ref(null)

const stats = computed(() => {
  const pendientes = aspirantes.value.filter(
    (asp) => asp.estado?.toLowerCase() === 'pendiente'
  ).length
  const aprobadas = aspirantes.value.filter(
    (asp) => asp.estado?.toLowerCase() === 'aprobado'
  ).length
  const rechazadas = aspirantes.value.filter(
    (asp) => asp.estado?.toLowerCase() === 'rechazada'
  ).length
  const total = aspirantes.value.length

  return [
    { label: 'Pendientes', value: pendientes, trend: `+${pendientes}`, color: 'warning' },
    { label: 'Aprobadas', value: aprobadas, trend: `+${aprobadas}`, color: 'success' },
    { label: 'Rechazadas', value: rechazadas, trend: `-${rechazadas}`, color: 'error' },
    { label: 'Total', value: total, trend: `+${total}`, color: 'info' },
  ]
})

const router = useRouter()

const solicitudes = ref([
  {
    id: 1,
    docente: 'Maria Garcia Lopez',
    iniciales: 'MG',
    tipo: 'Cita médica',
    fecha: '28/04/2026',
    materia: 'Cálculo',
    urgente: true,
  },
  {
    id: 2,
    docente: 'Carlos Rodriguez',
    iniciales: 'CR',
    tipo: 'Calamidad',
    fecha: '25/04/2026',
    materia: 'Física',
    urgente: true,
  },
])

const aspirantes = ref<any[]>([])

onMounted(() => {
  const savedAspirantes = localStorage.getItem('aspirantes')
  if (savedAspirantes) {
    try {
      aspirantes.value = JSON.parse(savedAspirantes)
    } catch (error) {
      console.warn('No se pudo cargar aspirantes desde localStorage:', error)
    }
  }
})

const actividadReciente = ref([
  { tipo: 'nueva', accion: 'Nueva solicitud de Maria Garcia Lopez', tiempo: 'Hace 5 minutos' },
  { tipo: 'aprobado', accion: 'Solicitud aprobada para Carlos Rodriguez', tiempo: 'Hace 1 hora' },
  { tipo: 'rechazado', accion: 'Solicitud rechazada por falta de documentos', tiempo: 'Ayer' },
])

const solicitudesPendientes = computed(() => solicitudes.value)

const aspirantesFiltrados = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return aspirantes.value

  return aspirantes.value.filter(asp =>
    [asp.cedula, asp.correo, asp.celular, asp.telefono, asp.lugarResidencia, asp.estado, asp.tipoInscripcion, asp.caso]
      .some(value => value.toLowerCase().includes(query))
  )
})

const exportFormat = ref('csv')

const createCsvContent = () => {
  const rows = [
    ['Etiqueta', 'Valor', 'Tendencia'],
    ...stats.value.map(stat => [stat.label, stat.value.toString(), stat.trend])
  ]

  return rows
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

const createHtmlReport = () => {
  const rows = stats.value.map(stat => `
      <tr>
        <td>${stat.label}</td>
        <td>${stat.value}</td>
        <td>${stat.trend}</td>
      </tr>
    `).join('')

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>Reporte del Director</h1>
        <table>
          <thead>
            <tr>
              <th>Etiqueta</th>
              <th>Valor</th>
              <th>Tendencia</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `
}

const saveFile = async (content:string | Blob, suggestedName:string, mime:string, accept:any) => {
  if ('showSaveFilePicker' in window && (window as any).showSaveFilePicker) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: suggestedName.split('.').pop() + ' File',
            accept
          }
        ]
      })
      const writable = await handle.createWritable()
      await writable.write(typeof content === 'string' ? new Blob([content], { type: mime }) : content)
      await writable.close()
      return true
    } catch (error) {
      console.warn('showSaveFilePicker cancelado o falló:', error)
      return false
    }
  }
  return false
}

const exportPdf = async () => {
  const html = createHtmlReport()
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    await dialog.alert('No se pudo abrir una ventana para imprimir. Intenta permitir ventanas emergentes.', { variant: 'error' })
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

const exportReport = async () => {
  if (exportFormat.value === 'pdf') {
    exportPdf()
    return
  }

  let content: string | Blob = ''
  let name = 'reporte-director'
  let mime = 'text/plain'
  let accept = {}

  if (exportFormat.value === 'csv') {
    content = createCsvContent()
    name += '.csv'
    mime = 'text/csv'
    accept = { 'text/csv': ['.csv'] }
  } else if (exportFormat.value === 'excel') {
    content = createHtmlReport()
    name += '.xls'
    mime = 'application/vnd.ms-excel'
    accept = { 'application/vnd.ms-excel': ['.xls'] }
  } else if (exportFormat.value === 'word') {
    content = createHtmlReport()
    name += '.doc'
    mime = 'application/msword'
    accept = { 'application/msword': ['.doc'] }
  } else if (exportFormat.value === 'txt') {
    content = createCsvContent()
    name += '.txt'
    mime = 'text/plain'
    accept = { 'text/plain': ['.txt'] }
  } else {
    await dialog.alert('Formato no soportado.', { variant: 'error' })
    return
  }

  const saved = await saveFile(content, name, mime, accept)
  if (!saved) {
    await dialog.alert('Este navegador no soporta el diálogo nativo de guardado. No se pudo exportar sin descargar.', { variant: 'error' })
  }
}

const aprobar = (id:number) => {
  solicitudes.value = solicitudes.value.filter(s => s.id !== id)
}

const rechazar = async (id: number) => {
  const motivo = await dialog.prompt('Escribe el motivo del rechazo:', {
    title: 'Rechazar aspirante',
    inputPlaceholder: 'Motivo del rechazo',
  })
  if (motivo) {
    solicitudes.value = solicitudes.value.filter(s => s.id !== id)
  }
}

const editarAspirante = (aspirante:any) => {
  router.push(`/director/aspirantes/editar/${aspirante.cedula}`)
}

const eliminarAspirante = async (aspirante: any) => {
  const confirmDelete = await dialog.confirm(`¿Eliminar aspirante ${aspirante.cedula}?`, {
    title: 'Eliminar aspirante',
    variant: 'danger',
    confirmText: 'Eliminar',
  })
  if (!confirmDelete) return
  aspirantes.value = aspirantes.value.filter(a => a.cedula !== aspirante.cedula)
  localStorage.setItem('aspirantes', JSON.stringify(aspirantes.value))
}

const ver = (sol:any) => {
  selected.value = sol
}
</script>

<template>
  <div class="dashboard">
    <div class="page-header">
      <div class="header-content">
        <h1>Aspirantes</h1>
        <p>Listado de aspirantes y sus datos de inscripción</p>
      </div>
      <div class="header-actions">
        <router-link to="/director/aspirantes/crear" class="btn btn-black">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo aspirante
        </router-link>
        <button type="button" @click="exportReport" class="btn btn-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar reporte
        </button>
      </div>
    </div>

    <!-- Stats -->
    <section class="stats-grid">
      <div v-for="stat in stats" :key="stat.label" class="stat-card">
        <div class="stat-header">
          <span class="stat-label">{{ stat.label }}</span>
          <span :class="['stat-trend', stat.color]">{{ stat.trend }}</span>
        </div>
        <span class="stat-value">{{ stat.value }}</span>
      </div>
    </section>

    <div class="content-grid">
      <!-- Aspirantes Table -->
      <section class="card main-card">
        <div class="card-header">
          <h2>Aspirantes</h2>
          <span class="badge">{{ aspirantesFiltrados.length }} registros</span>
        </div>
        <div class="card-content">
          <div class="table-toolbar">
            <input
              v-model="search"
              type="text"
              placeholder="Buscar por cédula, correo o celular..."
              class="table-search"
            />
          </div>
          <div class="table-responsive">
            <table class="aspirantes-table">
              <thead>
                <tr>
                  <th>CÉDULA</th>
                  <th>CORREO</th>
                  <th>CELULAR</th>
                  <th>TELÉFONO</th>
                  <th>LUGAR DE RESIDENCIA</th>
                  <th>ESTADO</th>
                  <th>TIPO DE INSCRIPCIÓN</th>
                  <th>CASO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="aspirante in aspirantesFiltrados" :key="aspirante.cedula">
                  <td>{{ aspirante.cedula }}</td>
                  <td>{{ aspirante.correo }}</td>
                  <td>{{ aspirante.celular }}</td>
                  <td>{{ aspirante.telefono }}</td>
                  <td>{{ aspirante.lugarResidencia }}</td>
                  <td>{{ aspirante.estado }}</td>
                  <td>{{ aspirante.tipoInscripcion }}</td>
                  <td>{{ aspirante.caso }}</td>
                  <td class="row-actions">
                    <button type="button" class="action-btn edit" @click="editarAspirante(aspirante)" title="Editar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                      </svg>
                    </button>
                    <button type="button" class="action-btn delete" @click="eliminarAspirante(aspirante)" title="Eliminar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6 17.5 20a2 2 0 0 1-2 2H8.5a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
                <tr v-if="!aspirantesFiltrados.length">
                  <td colspan="9" class="empty-row">No hay aspirantes que coincidan con la búsqueda.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Recent Activity -->
      <section class="card side-card">
        <div class="card-header">
          <h2>Actividad reciente</h2>
        </div>
        <div class="card-content">
          <div class="activity-list">
            <div v-for="(actividad, index) in actividadReciente" :key="index" class="activity-item">
              <div :class="['activity-dot', actividad.tipo]"></div>
              <div class="activity-content">
                <p class="activity-text">{{ actividad.accion }}</p>
                <span class="activity-time">{{ actividad.tiempo }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="card-footer">
         <router-link to="/director/solicitudes" class="link">Ver todo el historial</router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.header-content h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.3px;
}

.header-content p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition);
}

.btn-secondary {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-background);
  border-color: var(--color-text-muted);
}

.btn-primary {
  background: var(--color-accent);
  color: white;
  border: 1px solid transparent;
}

.btn-primary:hover {
  background: var(--color-accent-light);
}

.btn-black {
  background: var(--color-text);
  color: white;
  border: 1px solid transparent;
}

.btn-black:hover {
  background: #111827;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat-trend {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.stat-trend.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.stat-trend.success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.stat-trend.error {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.stat-trend.info {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -1px;
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 24px;
}

/* Cards */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.table-search {
  width: 100%;
  max-width: 420px;
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.table-responsive {
  overflow-x: auto;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.action-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: var(--color-background);
  transition: all var(--transition);
  cursor: pointer;
}

.action-btn:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

.action-btn.edit {
  border-color: rgba(59, 130, 246, 0.24);
  color: var(--color-info);
}

.action-btn.edit:hover {
  background: rgba(59, 130, 246, 0.12);
}

.action-btn.delete {
  border-color: rgba(239, 68, 68, 0.24);
  color: var(--color-error);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.12);
}

.aspirantes-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

.aspirantes-table th,
.aspirantes-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border-light);
  text-align: left;
  font-size: 13px;
}

.aspirantes-table th {
  color: var(--color-text-secondary);
  background: var(--color-surface);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.aspirantes-table tbody tr:hover {
  background: rgba(15, 23, 42, 0.03);
}

.empty-row {
  padding: 24px;
  text-align: center;
  color: var(--color-text-secondary);
}

.badge {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 20px;
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.card-content {
  padding: 16px 24px;
}

.card-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--color-border-light);
}

.link {
  font-size: 13px;
  color: var(--color-accent);
  font-weight: 500;
}

.link:hover {
  text-decoration: underline;
}

/* Requests List */
.requests-list {
  display: flex;
  flex-direction: column;
}

.request-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.request-item:last-child {
  border-bottom: none;
}

.request-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.request-avatar {
  width: 40px;
  height: 40px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.request-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.request-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.request-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.urgent-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--color-error-bg);
  color: var(--color-error);
}

.request-details {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.request-type {
  font-weight: 500;
  color: var(--color-text-secondary);
}

.separator {
  color: var(--color-text-muted);
}

.request-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
  transition: all var(--transition);
}

.action-btn.view {
  background: var(--color-background);
  color: var(--color-text-secondary);
}

.action-btn.view:hover {
  background: var(--color-border);
  color: var(--color-text);
}

.action-btn.approve {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.action-btn.approve:hover {
  background: var(--color-success);
  color: white;
}

.action-btn.reject {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.action-btn.reject:hover {
  background: var(--color-error);
  color: white;
}

/* Activity List */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-item {
  display: flex;
  gap: 12px;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.activity-dot.aprobado {
  background: var(--color-success);
}

.activity-dot.rechazado {
  background: var(--color-error);
}

.activity-dot.nueva {
  background: var(--color-accent);
}

.activity-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-text {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.5;
}

.activity-time {
  font-size: 12px;
  color: var(--color-text-muted);
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .request-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .request-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
