<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { db } from '@/lib/firebase'
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, updateDoc, serverTimestamp, orderBy, query
} from 'firebase/firestore'
import { dialog } from '@/lib/nucleo/dialog'
import TableDetailModal from '@/componentes/modales/TableDetailModal.vue'
import { buildDetailFields } from '@/lib/nucleo/tableDetail'

const llamadas = ref<any[]>([])
const loading = ref(true)
const busqueda = ref('')
const activeFilter = ref('todos')

const PAGE_SIZE = 20
const paginaActual = ref(1)

// Modal agregar/editar
const modalVisible = ref(false)
const modoEdicion = ref(false)
const llamadaEditando = ref<any>(null)

const formVacio = () => ({
  fecha: '',
  hora: '',
  nombre: '',
  estamento: '',
  telefono: '',
  asunto: '',
  estado: 'Pendiente',
  proxAccion: '',
  prioridad: 'Media',
  notas: '',
})

const form = ref(formVacio())

const detalleVisible = ref(false)
const detalleTitle = ref('')
const detalleSubtitle = ref('')
const detalleFields = ref<{ label: string; value: string }[]>([])

const verDetalleLlamada = (llamada: any) => {
  detalleTitle.value = llamada.nombre || 'Llamada'
  detalleSubtitle.value = [llamada.fecha, llamada.hora].filter(Boolean).join(' · ')
  detalleFields.value = buildDetailFields(llamada, [
    { key: 'fecha', label: 'Fecha' },
    { key: 'hora', label: 'Hora' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'estamento', label: 'Estamento' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'asunto', label: 'Asunto' },
    { key: 'estado', label: 'Estado' },
    { key: 'proxAccion', label: 'Próxima acción' },
    { key: 'prioridad', label: 'Prioridad' },
    { key: 'notas', label: 'Notas' },
  ])
  detalleVisible.value = true
}

// Toast
const toastVisible = ref(false)
const toastMensaje = ref('')
let toastTimeout: ReturnType<typeof setTimeout>

const estados = ['Pendiente', 'Realizada', 'No contestó', 'Cancelada']
const prioridades = ['🔴 Alta', '🟡 Media', '🟢 Baja']
const estamentos = ['Administrativo', 'Docente', 'Estudiante', 'Externo']

const filtros = [
  { id: 'todos', label: 'Todos' },
  { id: 'Pendiente', label: 'Pendientes' },
  { id: 'Realizada', label: 'Realizadas' },
  { id: 'No contestó', label: 'No contestó' },
]

const cargarLlamadas = async () => {
  try {
    const q = query(collection(db, 'llamadas'), orderBy('creadoEn', 'desc'))
    const snap = await getDocs(q)
    llamadas.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(cargarLlamadas)

const llamadasFiltradas = computed(() => {
  let lista = llamadas.value

  if (activeFilter.value !== 'todos') {
    lista = lista.filter(l => l.estado === activeFilter.value)
  }

  if (busqueda.value.trim()) {
    const texto = busqueda.value.toLowerCase()
    lista = lista.filter(l =>
      l.nombre?.toLowerCase().includes(texto) ||
      l.telefono?.toString().includes(texto) ||
      l.asunto?.toLowerCase().includes(texto)
    )
  }

  return lista
})

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(llamadasFiltradas.value.length / PAGE_SIZE))
)

const llamadasPaginadas = computed(() => {
  const inicio = (paginaActual.value - 1) * PAGE_SIZE
  return llamadasFiltradas.value.slice(inicio, inicio + PAGE_SIZE)
})

watch([activeFilter, busqueda], () => {
  paginaActual.value = 1
})

const irPagina = (pagina: number) => {
  paginaActual.value = pagina
}

const abrirModalNuevo = () => {
  modoEdicion.value = false
  form.value = formVacio()
  modalVisible.value = true
}

const abrirModalEditar = (llamada: any) => {
  modoEdicion.value = true
  llamadaEditando.value = llamada
  form.value = {
    fecha: llamada.fecha,
    hora: llamada.hora,
    nombre: llamada.nombre,
    estamento: llamada.estamento,
    telefono: llamada.telefono,
    asunto: llamada.asunto,
    estado: llamada.estado,
    proxAccion: llamada.proxAccion,
    prioridad: llamada.prioridad,
    notas: llamada.notas,
  }
  modalVisible.value = true
}

const cerrarModal = () => {
  modalVisible.value = false
  llamadaEditando.value = null
}

const mostrarToast = (mensaje: string) => {
  toastMensaje.value = mensaje
  toastVisible.value = true
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toastVisible.value = false }, 3000)
}

const guardar = async () => {
  const { fecha, hora, nombre, estamento, telefono, asunto, estado, proxAccion, prioridad, notas } = form.value
  if (!fecha || !nombre || !asunto) return

  try {
    if (modoEdicion.value && llamadaEditando.value) {
      await updateDoc(doc(db, 'llamadas', llamadaEditando.value.id), {
        fecha, hora, nombre, estamento, telefono, asunto, estado, proxAccion, prioridad, notas
      })
      const idx = llamadas.value.findIndex(l => l.id === llamadaEditando.value.id)
      if (idx !== -1) llamadas.value[idx] = { ...llamadas.value[idx], fecha, hora, nombre, estamento, telefono, asunto, estado, proxAccion, prioridad, notas }
      mostrarToast('Llamada actualizada correctamente')
    } else {
      const docRef = await addDoc(collection(db, 'llamadas'), {
        fecha, hora, nombre, estamento, telefono, asunto, estado, proxAccion, prioridad, notas,
        creadoEn: serverTimestamp()
      })
      llamadas.value.unshift({ id: docRef.id, fecha, hora, nombre, estamento, telefono, asunto, estado, proxAccion, prioridad, notas })
      mostrarToast('Llamada registrada correctamente')
    }
    cerrarModal()
  } catch (e) {
    console.error(e)
  }
}

const eliminar = async (id: string) => {
  const ok = await dialog.confirm('¿Seguro que deseas eliminar este registro?', {
    title: 'Eliminar llamada',
    variant: 'danger',
    confirmText: 'Eliminar',
  })
  if (!ok) return
  try {
    await deleteDoc(doc(db, 'llamadas', id))
    llamadas.value = llamadas.value.filter(l => l.id !== id)
    mostrarToast('Registro eliminado')
  } catch (e) {
    console.error(e)
  }
}

const badgeEstado = (estado: string) => {
  const map: Record<string, string> = {
    'Pendiente': 'badge-pendiente',
    'Realizada': 'badge-realizada',
    'No contestó': 'badge-nocontesto',
    'Cancelada': 'badge-cancelada',
  }
  return map[estado] || ''
}
</script>

<template>
  <div class="director-list-page">

    <section class="command-bar">
      <div class="command-row">
        <div class="search-box">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="busqueda"
            class="search-input"
            type="search"
            placeholder="Buscar por nombre, teléfono o asunto..."
          />
          <button v-if="busqueda" type="button" class="search-clear" aria-label="Limpiar búsqueda" @click="busqueda = ''">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="command-actions">
          <button type="button" class="btn btn-primary" @click="abrirModalNuevo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nueva llamada
          </button>
        </div>
      </div>

      <div class="filter-row">
        <button
          v-for="filtro in filtros"
          :key="filtro.id"
          type="button"
          :class="['filter-chip', { active: activeFilter === filtro.id }]"
          @click="activeFilter = filtro.id"
        >
          {{ filtro.label }}
        </button>
      </div>
    </section>

    <section class="table-section">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando registros...</span>
      </div>

      <div v-else class="table-card">
        <div class="table-card-header">
          <div>
            <h2 class="table-title">Lista de llamadas</h2>
            <p class="table-subtitle">
              {{ llamadasFiltradas.length }} resultado{{ llamadasFiltradas.length === 1 ? '' : 's' }}
              <template v-if="busqueda.trim()"> para «{{ busqueda }}»</template>
            </p>
          </div>
        </div>

        <div v-if="llamadasFiltradas.length === 0" class="empty-panel">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <p class="empty-title">No se encontraron registros</p>
          <p class="empty-desc">Prueba otro filtro o registra una nueva llamada.</p>
          <button type="button" class="btn btn-primary btn-sm" @click="abrirModalNuevo">Nueva llamada</button>
        </div>

        <div v-else class="table-wrap">
          <table class="data-table llamadas-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Nombre</th>
                <th>Estamento</th>
                <th>Teléfono</th>
                <th>Asunto</th>
                <th>Estado</th>
                <th>Próx. acción</th>
                <th>Prioridad</th>
                <th class="th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="llamada in llamadasPaginadas"
                :key="llamada.id"
                class="row-clickable"
                @click="verDetalleLlamada(llamada)"
              >
                <td>{{ llamada.fecha }}</td>
                <td>{{ llamada.hora }}</td>
                <td>{{ llamada.nombre }}</td>
                <td>{{ llamada.estamento }}</td>
                <td>{{ llamada.telefono }}</td>
                <td class="td-asunto">{{ llamada.asunto }}</td>
                <td>
                  <span :class="['status-badge', badgeEstado(llamada.estado)]">
                    {{ llamada.estado }}
                  </span>
                </td>
                <td>{{ llamada.proxAccion }}</td>
                <td>{{ llamada.prioridad }}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="action-btn" aria-label="Editar" title="Editar" @click.stop="abrirModalEditar(llamada)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                      </svg>
                    </button>
                    <button type="button" class="action-btn danger" aria-label="Eliminar" title="Eliminar" @click.stop="eliminar(llamada.id)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="llamadasFiltradas.length > 0" class="table-footer">
          <span>
            {{ llamadasFiltradas.length }} registro{{ llamadasFiltradas.length === 1 ? '' : 's' }}
            · Página {{ paginaActual }} de {{ totalPaginas }}
          </span>
          <div class="pagination-controls">
            <button
              type="button"
              class="page-nav"
              :disabled="paginaActual <= 1"
              @click="irPagina(paginaActual - 1)"
            >
              Anterior
            </button>
            <button
              type="button"
              class="page-nav"
              :disabled="paginaActual >= totalPaginas"
              @click="irPagina(paginaActual + 1)"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </section>

    <TableDetailModal
      :open="detalleVisible"
      :title="detalleTitle"
      :subtitle="detalleSubtitle"
      :fields="detalleFields"
      @close="detalleVisible = false"
    />

    <!-- MODAL AGREGAR / EDITAR -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalVisible" class="modal-overlay" @click.self="cerrarModal">
          <div class="modal-card modal-form modal-form--wide" role="dialog" aria-modal="true">
            <div class="modal-top">
              <div class="modal-top-row">
                <div class="modal-icon modal-icon--phone">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div class="modal-top-text">
                  <h2 class="modal-title">{{ modoEdicion ? 'Editar llamada' : 'Nueva llamada' }}</h2>
                  <p class="modal-subtitle">{{ modoEdicion ? 'Modifica los datos del registro' : 'Registra una nueva llamada' }}</p>
                </div>
                <button type="button" class="modal-close" aria-label="Cerrar" @click="cerrarModal">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="modal-body">
              <section class="modal-section">
                <h3 class="modal-section-title">Datos de la llamada</h3>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="llamada-fecha">Fecha *</label>
                    <input id="llamada-fecha" v-model="form.fecha" type="date" class="field-input"/>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="llamada-hora">Hora</label>
                    <input id="llamada-hora" v-model="form.hora" type="time" class="field-input"/>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="llamada-nombre">Nombre *</label>
                    <input id="llamada-nombre" v-model="form.nombre" class="field-input" placeholder="Nombre completo"/>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="llamada-telefono">Teléfono</label>
                    <input id="llamada-telefono" v-model="form.telefono" class="field-input" placeholder="Número o extensión"/>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="llamada-estamento">Estamento</label>
                    <div class="select-wrapper">
                      <select id="llamada-estamento" v-model="form.estamento" class="field-input field-select">
                        <option value="" disabled>Selecciona...</option>
                        <option v-for="e in estamentos" :key="e" :value="e">{{ e }}</option>
                      </select>
                      <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="llamada-prioridad">Prioridad</label>
                    <div class="select-wrapper">
                      <select id="llamada-prioridad" v-model="form.prioridad" class="field-input field-select">
                        <option v-for="p in prioridades" :key="p" :value="p">{{ p }}</option>
                      </select>
                      <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label" for="llamada-asunto">Asunto *</label>
                  <textarea id="llamada-asunto" v-model="form.asunto" class="field-input field-textarea" placeholder="Describe el motivo de la llamada..."/>
                </div>
              </section>

              <section class="modal-section">
                <h3 class="modal-section-title">Seguimiento</h3>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="llamada-estado">Estado</label>
                    <div class="select-wrapper">
                      <select id="llamada-estado" v-model="form.estado" class="field-input field-select">
                        <option v-for="e in estados" :key="e" :value="e">{{ e }}</option>
                      </select>
                      <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="llamada-prox">Próxima acción</label>
                    <input id="llamada-prox" v-model="form.proxAccion" class="field-input" placeholder="¿Qué sigue?"/>
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label" for="llamada-notas">Notas adicionales</label>
                  <textarea id="llamada-notas" v-model="form.notas" class="field-input field-textarea" placeholder="Observaciones o detalles extra..."/>
                </div>
              </section>
            </div>

            <div class="modal-footer modal-footer-actions">
              <button type="button" class="btn btn-secondary" @click="cerrarModal">Cancelar</button>
              <button type="button" class="btn btn-primary" @click="guardar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {{ modoEdicion ? 'Guardar cambios' : 'Registrar llamada' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ───── TOAST ───── -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastVisible" class="toast-success">
          <div class="toast-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span>{{ toastMensaje }}</span>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.llamadas-table {
  table-layout: auto;
  min-width: 900px;
}

.td-asunto {
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-success {
  position: fixed; bottom: 28px; right: 28px; z-index: 2000;
  display: flex; align-items: center; gap: 12px;
  background: #111827; color: white;
  padding: 14px 20px; border-radius: 12px;
  font-size: 13px; font-weight: 500;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.toast-icon {
  width: 28px; height: 28px; border-radius: 50%; background: #10b981;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px) scale(0.95); }
</style>