<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { db } from '@/lib/firebase'
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, updateDoc, serverTimestamp, orderBy, query
} from 'firebase/firestore'
import TableDetailModal from '@/componentes/modales/TableDetailModal.vue'
import { buildDetailFields } from '@/lib/nucleo/tableDetail'

const aspirantes = ref<any[]>([])
const loading = ref(true)
const busqueda = ref('')
const activeFilter = ref('todos')

const PAGE_SIZE = 20
const paginaActual = ref(1)

// Modal agregar/editar
const modalVisible = ref(false)
const modoEdicion = ref(false)
const aspiranteEditando = ref<any>(null)

const formVacio = () => ({
  cedula: '',
  nombre: '',
  correo: '',
  celular: '',
  telefono: '',
  lugarResidencia: '',
  tipoInscripcion: '',
  caso: '',
  observaciones: '',
  estado: 'Pendiente',
})

const form = ref(formVacio())

// Modal confirmar eliminación
const modalConfirmVisible = ref(false)
const aspiranteAEliminar = ref<any>(null)

const detalleVisible = ref(false)
const detalleTitle = ref('')
const detalleSubtitle = ref('')
const detalleFields = ref<{ label: string; value: string }[]>([])

const verDetalleAspirante = (aspirante: any) => {
  detalleTitle.value = aspirante.nombre || 'Aspirante'
  detalleSubtitle.value = aspirante.cedula ? `Cédula ${aspirante.cedula}` : ''
  detalleFields.value = buildDetailFields(aspirante, [
    { key: 'cedula', label: 'Cédula' },
    { key: 'nombre', label: 'Nombre completo' },
    { key: 'correo', label: 'Correo' },
    { key: 'celular', label: 'Celular' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'lugarResidencia', label: 'Lugar de residencia' },
    { key: 'tipoInscripcion', label: 'Tipo de inscripción' },
    { key: 'caso', label: 'Caso' },
    { key: 'observaciones', label: 'Observaciones' },
    { key: 'estado', label: 'Estado' },
  ])
  detalleVisible.value = true
}

// Toast
const toastVisible = ref(false)
const toastMensaje = ref('')
let toastTimeout: ReturnType<typeof setTimeout>

const estados = ['Pendiente', 'Aprobado', 'Rechazado', 'En revisión']
const tiposInscripcion = ['Regular', 'Transferencia', 'Inclusión', 'Especial']

const filtros = [
  { id: 'todos', label: 'Todos' },
  { id: 'Pendiente', label: 'Pendientes' },
  { id: 'Aprobado', label: 'Aprobados' },
  { id: 'Rechazado', label: 'Rechazados' },
  { id: 'En revisión', label: 'En revisión' },
]

const cargarAspirantes = async () => {
  try {
    const q = query(collection(db, 'aspirantes'), orderBy('creadoEn', 'desc'))
    const snap = await getDocs(q)
    aspirantes.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(cargarAspirantes)

const aspirantesFiltrados = computed(() => {
  let lista = aspirantes.value

  if (activeFilter.value !== 'todos') {
    lista = lista.filter(a => a.estado === activeFilter.value)
  }

  if (busqueda.value.trim()) {
    const texto = busqueda.value.toLowerCase()
    lista = lista.filter(a =>
      a.nombre?.toLowerCase().includes(texto) ||
      a.cedula?.toString().includes(texto) ||
      a.correo?.toLowerCase().includes(texto)
    )
  }

  return lista
})

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(aspirantesFiltrados.value.length / PAGE_SIZE))
)

const aspirantesPaginados = computed(() => {
  const inicio = (paginaActual.value - 1) * PAGE_SIZE
  return aspirantesFiltrados.value.slice(inicio, inicio + PAGE_SIZE)
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

const abrirModalEditar = (aspirante: any) => {
  modoEdicion.value = true
  aspiranteEditando.value = aspirante
  form.value = {
    cedula: aspirante.cedula,
    nombre: aspirante.nombre,
    correo: aspirante.correo,
    celular: aspirante.celular,
    telefono: aspirante.telefono,
    lugarResidencia: aspirante.lugarResidencia,
    tipoInscripcion: aspirante.tipoInscripcion,
    caso: aspirante.caso,
    observaciones: aspirante.observaciones,
    estado: aspirante.estado,
  }
  modalVisible.value = true
}

const cerrarModal = () => {
  modalVisible.value = false
  aspiranteEditando.value = null
}

const mostrarToast = (mensaje: string) => {
  toastMensaje.value = mensaje
  toastVisible.value = true
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toastVisible.value = false }, 3000)
}

const guardar = async () => {
  const { cedula, nombre, correo, celular } = form.value
  if (!cedula || !nombre || !correo || !celular) return
   
  const datos = {
    cedula: form.value.cedula,
    nombre: form.value.nombre,
    correo: form.value.correo,
    celular: form.value.celular,
    telefono: form.value.telefono,
    lugarResidencia: form.value.lugarResidencia,
    tipoInscripcion: form.value.tipoInscripcion || 'Regular',
    caso: form.value.caso || 'General',
    observaciones: form.value.observaciones,
    estado: form.value.estado,
  }

  try {
    if (modoEdicion.value && aspiranteEditando.value) {
      await updateDoc(doc(db, 'aspirantes', aspiranteEditando.value.id), datos)
      const idx = aspirantes.value.findIndex(a => a.id === aspiranteEditando.value.id)
      if (idx !== -1) aspirantes.value[idx] = { ...aspirantes.value[idx], ...datos }
      mostrarToast('Aspirante actualizado correctamente')
    } else {
      const docRef = await addDoc(collection(db, 'aspirantes'), {
        ...datos,
        creadoEn: serverTimestamp()
      })
      aspirantes.value.unshift({ id: docRef.id, ...datos })
      mostrarToast('Aspirante registrado correctamente')
    }
    cerrarModal()
  } catch (e) {
    console.error(e)
  }
}

// --- Eliminación ---
const eliminarAspirante = (aspirante: any) => {
  aspiranteAEliminar.value = aspirante
  modalConfirmVisible.value = true
}

const confirmarEliminacion = async () => {
  if (!aspiranteAEliminar.value) return
  try {
    await deleteDoc(doc(db, 'aspirantes', aspiranteAEliminar.value.id))
    aspirantes.value = aspirantes.value.filter(a => a.id !== aspiranteAEliminar.value.id)
    mostrarToast('Aspirante eliminado correctamente')
  } catch (e) {
    console.error(e)
  } finally {
    modalConfirmVisible.value = false
    aspiranteAEliminar.value = null
  }
}

const cancelarEliminacion = () => {
  modalConfirmVisible.value = false
  aspiranteAEliminar.value = null
}

const badgeEstado = (estado: string) => {
  const map: Record<string, string> = {
    'Pendiente': 'badge-pendiente',
    'Aprobado': 'badge-aprobado',
    'Rechazado': 'badge-rechazado',
    'En revisión': 'badge-revision',
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
            placeholder="Buscar por nombre, cédula o correo..."
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
            Nuevo aspirante
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
        <span>Cargando aspirantes...</span>
      </div>

      <div v-else class="table-card">
        <div class="table-card-header">
          <div>
            <h2 class="table-title">Lista de aspirantes</h2>
            <p class="table-subtitle">
              {{ aspirantesFiltrados.length }} resultado{{ aspirantesFiltrados.length === 1 ? '' : 's' }}
              <template v-if="busqueda.trim()"> para «{{ busqueda }}»</template>
            </p>
          </div>
        </div>

        <div v-if="aspirantesFiltrados.length === 0" class="empty-panel">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p class="empty-title">No se encontraron aspirantes</p>
          <p class="empty-desc">Prueba otro filtro o registra un nuevo aspirante.</p>
          <button type="button" class="btn btn-primary btn-sm" @click="abrirModalNuevo">Nuevo aspirante</button>
        </div>

        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Celular</th>
                <th>Lugar</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th class="th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="aspirante in aspirantesPaginados"
                :key="aspirante.id"
                class="row-clickable"
                @click="verDetalleAspirante(aspirante)"
              >
                <td>{{ aspirante.cedula }}</td>
                <td>{{ aspirante.nombre }}</td>
                <td>{{ aspirante.correo }}</td>
                <td>{{ aspirante.celular }}</td>
                <td>{{ aspirante.lugarResidencia }}</td>
                <td>{{ aspirante.tipoInscripcion }}</td>
                <td>
                  <span :class="['status-badge', badgeEstado(aspirante.estado)]">
                    {{ aspirante.estado }}
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="action-btn" aria-label="Editar" title="Editar" @click.stop="abrirModalEditar(aspirante)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                      </svg>
                    </button>
                    <button type="button" class="action-btn danger" aria-label="Eliminar" title="Eliminar" @click.stop="eliminarAspirante(aspirante)">
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

        <div v-if="aspirantesFiltrados.length > 0" class="table-footer">
          <span>
            {{ aspirantesFiltrados.length }} aspirante{{ aspirantesFiltrados.length === 1 ? '' : 's' }}
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

    <!-- MODAL CREAR / EDITAR -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalVisible" class="modal-overlay" @click.self="cerrarModal">
          <div class="modal-card modal-form modal-form--wide" role="dialog" aria-modal="true">
            <div class="modal-top">
              <div class="modal-top-row">
                <div class="modal-icon modal-icon--user-plus">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                </div>
                <div class="modal-top-text">
                  <h2 class="modal-title">{{ modoEdicion ? 'Editar aspirante' : 'Nuevo aspirante' }}</h2>
                  <p class="modal-subtitle">{{ modoEdicion ? 'Modifica los datos del aspirante' : 'Registra un nuevo aspirante' }}</p>
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
                <h3 class="modal-section-title">Datos personales</h3>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="aspirante-cedula">Cédula *</label>
                    <input id="aspirante-cedula" v-model="form.cedula" type="text" class="field-input field-mono" placeholder="Ej. 1234567890" :disabled="modoEdicion"/>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="aspirante-nombre">Nombre completo *</label>
                    <input id="aspirante-nombre" v-model="form.nombre" type="text" class="field-input" placeholder="Ej. Ana Pérez"/>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="aspirante-correo">Correo *</label>
                    <input id="aspirante-correo" v-model="form.correo" type="email" class="field-input" placeholder="correo@ejemplo.com"/>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="aspirante-celular">Celular *</label>
                    <input id="aspirante-celular" v-model="form.celular" type="text" class="field-input" placeholder="Ej. 0987654321"/>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="aspirante-telefono">Teléfono</label>
                    <input id="aspirante-telefono" v-model="form.telefono" type="text" class="field-input" placeholder="Opcional"/>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="aspirante-lugar">Lugar de residencia</label>
                    <input id="aspirante-lugar" v-model="form.lugarResidencia" type="text" class="field-input" placeholder="Ciudad / Barrio"/>
                  </div>
                </div>
              </section>

              <section class="modal-section">
                <h3 class="modal-section-title">Inscripción</h3>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="aspirante-tipo">Tipo de inscripción</label>
                    <div class="select-wrapper">
                      <select id="aspirante-tipo" v-model="form.tipoInscripcion" class="field-input field-select">
                        <option value="" disabled>Selecciona...</option>
                        <option v-for="t in tiposInscripcion" :key="t" :value="t">{{ t }}</option>
                      </select>
                      <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="aspirante-estado">Estado</label>
                    <div class="select-wrapper">
                      <select id="aspirante-estado" v-model="form.estado" class="field-input field-select">
                        <option v-for="e in estados" :key="e" :value="e">{{ e }}</option>
                      </select>
                      <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label" for="aspirante-caso">Caso</label>
                  <input id="aspirante-caso" v-model="form.caso" type="text" class="field-input" placeholder="Ej. Inclusión, General..."/>
                </div>
                <div class="field-group">
                  <label class="field-label" for="aspirante-obs">Observaciones</label>
                  <textarea id="aspirante-obs" v-model="form.observaciones" class="field-input field-textarea" placeholder="Información adicional sobre el aspirante..."/>
                </div>
              </section>
            </div>

            <div class="modal-footer modal-footer-actions">
              <button type="button" class="btn btn-secondary" @click="cerrarModal">Cancelar</button>
              <button type="button" class="btn btn-primary" @click="guardar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {{ modoEdicion ? 'Guardar cambios' : 'Registrar aspirante' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- MODAL CONFIRMAR ELIMINACIÓN -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalConfirmVisible" class="modal-overlay" @click.self="cancelarEliminacion">
          <div class="modal-card modal-sm" role="dialog" aria-modal="true">
            <div class="modal-top">
              <div class="modal-top-row">
                <div class="modal-icon modal-icon--danger">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </div>
                <div class="modal-top-text">
                  <h2 class="modal-title">Eliminar aspirante</h2>
                  <p class="modal-subtitle">Esta acción no se puede deshacer</p>
                </div>
              </div>
            </div>
            <div class="modal-body modal-body--compact">
              <p class="confirm-text">
                ¿Seguro que quieres eliminar a
                <strong>{{ aspiranteAEliminar?.nombre }}</strong>?
              </p>
            </div>
            <div class="modal-footer modal-footer-actions">
              <button type="button" class="btn btn-secondary" @click="cancelarEliminacion">Cancelar</button>
              <button type="button" class="btn btn-delete" @click="confirmarEliminacion">Eliminar</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- TOAST -->
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
.toast-success {
  position: fixed; bottom: 28px; right: 28px; z-index: 2000;
  display: flex; align-items: center; gap: 12px;
  background: #111827; color: white;
  padding: 14px 20px; border-radius: 12px;
  font-size: 13px; font-weight: 500;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.toast-icon { width: 28px; height: 28px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px) scale(0.95); }
</style>