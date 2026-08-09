<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { db } from '@/lib/firebase'
import { collection, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { dialog } from '@/lib/dialog'
import TableDetailModal from '@/components/TableDetailModal.vue'
import ExcelImportGuideModal from '@/components/ExcelImportGuideModal.vue'
import { buildDetailFields } from '@/lib/tableDetail'

const activeFilter = ref('todos')
const busqueda = ref('')
const materias = ref<any[]>([])
const loading = ref(true)

const PAGE_SIZE = 20
const paginaActual = ref(1)

// Modal crear/editar
const modalVisible = ref(false)
const modalModo = ref<'crear' | 'editar'>('crear')
const materiaEditando = ref<any>(null)
const formMateria = ref({
  codigo: '',
  nombre: '',
  semestre: '',
  dia: '',
  hora: '',
  profesor: ''
})

// Modal confirmar eliminación
const modalConfirmVisible = ref(false)
const materiaAEliminar = ref<any>(null)

const detalleVisible = ref(false)
const detalleTitle = ref('')
const detalleSubtitle = ref('')
const detalleFields = ref<{ label: string; value: string }[]>([])

const verDetalleMateria = (materia: any) => {
  detalleTitle.value = materia.nombre || 'Materia'
  detalleSubtitle.value = materia.codigo ? `Código ${materia.codigo}` : ''
  detalleFields.value = buildDetailFields(materia, [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'semestre', label: 'Semestre' },
    { key: 'dia', label: 'Día' },
    { key: 'hora', label: 'Hora' },
    { key: 'profesor', label: 'Profesor' },
  ])
  detalleVisible.value = true
}

// Modal errores importación
const modalErroresVisible = ref(false)
const erroresImport = ref<string[]>([])

// Toasts
const toastVisible = ref(false)
const toastImportVisible = ref(false)
const toastGuardadoVisible = ref(false)
const importCount = ref(0)
let toastTimeout: ReturnType<typeof setTimeout>
let toastImportTimeout: ReturnType<typeof setTimeout>
let toastGuardadoTimeout: ReturnType<typeof setTimeout>

// Input archivo
const inputArchivo = ref<HTMLInputElement | null>(null)
const modalImportGuideVisible = ref(false)

const abrirGuiaImportacion = () => {
  modalImportGuideVisible.value = true
}

const cerrarGuiaImportacion = () => {
  modalImportGuideVisible.value = false
}

const continuarImportacion = () => {
  modalImportGuideVisible.value = false
  inputArchivo.value?.click()
}

const semestres = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const cargarMaterias = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'materias'))
    materias.value = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const usuarios = ref<any[]>([])

const cargarUsuarios = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'usuarios'))
    usuarios.value = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  } catch (e) {
    console.error(e)
  }
}

onMounted(async () => {
  await Promise.all([cargarMaterias(), cargarUsuarios()])
})


const filtros = [
  { id: 'todos', label: 'Todas' },
  { id: '1', label: 'Semestre 1' },
  { id: '2', label: 'Semestre 2' },
  { id: '3', label: 'Semestre 3' },
  { id: '4', label: 'Semestre 4' },
  { id: '5', label: 'Semestre 5' },
  { id: '6', label: 'Semestre 6' },
  { id: '7', label: 'Semestre 7' },
  { id: '8', label: 'Semestre 8' },
  { id: '9', label: 'Semestre 9' },
  { id: '10', label: 'Semestre 10' },
]
const docentes = computed(() =>
  usuarios.value.filter(u => u.rol?.toLowerCase() === 'docente')
)

const materiasFiltradas = computed(() => {
  let lista = materias.value

  if (activeFilter.value !== 'todos') {
    lista = lista.filter(m => m.semestre?.toString() === activeFilter.value)
  }

  if (busqueda.value.trim()) {
    const texto = busqueda.value.toLowerCase()
    lista = lista.filter(m =>
      m.nombre?.toLowerCase().includes(texto) ||
      m.codigo?.toLowerCase().includes(texto) ||
      m.profesor?.toLowerCase().includes(texto)
    )
  }

  return lista
})

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(materiasFiltradas.value.length / PAGE_SIZE))
)

const materiasPaginadas = computed(() => {
  const inicio = (paginaActual.value - 1) * PAGE_SIZE
  return materiasFiltradas.value.slice(inicio, inicio + PAGE_SIZE)
})

watch([activeFilter, busqueda], () => {
  paginaActual.value = 1
})

const irPagina = (pagina: number) => {
  paginaActual.value = pagina
}

// --- Crear ---
const abrirModalCrear = () => {
  modalModo.value = 'crear'
  formMateria.value = { codigo: '', nombre: '', semestre: '', dia: '', hora: '', profesor: '' }
  modalVisible.value = true
}

// --- Editar ---
const abrirModalEditar = (materia: any) => {
  modalModo.value = 'editar'
  materiaEditando.value = materia
  formMateria.value = {
    codigo: materia.codigo,
    nombre: materia.nombre,
    semestre: materia.semestre,
    dia: materia.dia,
    hora: materia.hora,
    profesor: materia.profesor,
  }
  modalVisible.value = true
}

const cerrarModal = () => {
  modalVisible.value = false
  materiaEditando.value = null
}

const guardarMateria = async () => {
  const { codigo, nombre, semestre, dia, hora, profesor } = formMateria.value
  if (!codigo || !nombre || !semestre || !dia || !hora || !profesor) return

  try {
    if (modalModo.value === 'crear') {
      const yaExiste = materias.value.find(m => m.id === codigo)
      if (yaExiste) {
        await dialog.alert(`Ya existe una materia con el código "${codigo}"`, { variant: 'error' })
        return
      }
      await setDoc(doc(db, 'materias', codigo), { codigo, nombre, semestre, dia, hora, profesor })
      materias.value.push({ id: codigo, codigo, nombre, semestre, dia, hora, profesor })
    } else {
      await updateDoc(doc(db, 'materias', materiaEditando.value.id), { codigo, nombre, semestre, dia, hora, profesor })
      materiaEditando.value.codigo = codigo
      materiaEditando.value.nombre = nombre
      materiaEditando.value.semestre = semestre
      materiaEditando.value.dia = dia
      materiaEditando.value.hora = hora
      materiaEditando.value.profesor = profesor
    }
    cerrarModal()
    mostrarToastGuardado()
  } catch (e) {
    console.error(e)
  }
}

// --- Eliminar ---
const eliminarMateria = (materia: any) => {
  materiaAEliminar.value = materia
  modalConfirmVisible.value = true
}

const confirmarEliminacion = async () => {
  if (!materiaAEliminar.value) return
  try {
    await deleteDoc(doc(db, 'materias', materiaAEliminar.value.id))
    materias.value = materias.value.filter(m => m.id !== materiaAEliminar.value.id)
    mostrarToast()
  } catch (e) {
    console.error(e)
  } finally {
    modalConfirmVisible.value = false
    materiaAEliminar.value = null
  }
}

const cancelarEliminacion = () => {
  modalConfirmVisible.value = false
  materiaAEliminar.value = null
}

// --- Toasts ---
const mostrarToast = () => {
  toastVisible.value = true
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toastVisible.value = false }, 3000)
}

const mostrarToastImport = (cantidad: number) => {
  importCount.value = cantidad
  toastImportVisible.value = true
  clearTimeout(toastImportTimeout)
  toastImportTimeout = setTimeout(() => { toastImportVisible.value = false }, 4000)
}

const mostrarToastGuardado = () => {
  toastGuardadoVisible.value = true
  clearTimeout(toastGuardadoTimeout)
  toastGuardadoTimeout = setTimeout(() => { toastGuardadoVisible.value = false }, 3000)
}

// --- Importar Excel ---
const importarArchivo = async (event: Event) => {
  const archivo = (event.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  const data = await archivo.arrayBuffer()
  const workbook = XLSX.read(data)
  const hoja = workbook.Sheets[workbook.SheetNames[0]]
  const filas: any[] = XLSX.utils.sheet_to_json(hoja)

  const errores: string[] = []
  const codigosEnArchivo = new Set<string>()
  const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const numFila = i + 2
    const codigo = fila['codigo']?.toString().trim()
    const nombre = fila['nombre']?.toString().trim()
    const semestre = fila['semestre']?.toString().trim()
    const dia = fila['dia']?.toString().trim()
    const hora = fila['hora']?.toString().trim()
    const profesor = fila['profesor']?.toString().trim()

    if (!codigo || !nombre || !semestre || !dia || !hora || !profesor) {
      errores.push(`Fila ${numFila}: hay campos vacíos`)
      continue
    }

    if (codigosEnArchivo.has(codigo)) {
      errores.push(`Fila ${numFila}: el código "${codigo}" está duplicado en el archivo`)
    } else {
      codigosEnArchivo.add(codigo)
    }

    if (materias.value.find(m => m.id === codigo)) {
      errores.push(`Fila ${numFila}: el código "${codigo}" ya está registrado`)
    }

    if (!diasValidos.includes(dia)) {
      errores.push(`Fila ${numFila}: el día "${dia}" no es válido (usa Lunes, Martes, Miércoles, Jueves, Viernes o Sábado)`)
    }

    if (!/^\d{1,2}:\d{2}$/.test(hora)) {
      errores.push(`Fila ${numFila}: la hora "${hora}" no tiene formato válido (usa HH:MM, ej: 08:00)`)
    }

    const sem = parseInt(semestre)
    if (isNaN(sem) || sem < 1 || sem > 10) {
      errores.push(`Fila ${numFila}: el semestre "${semestre}" no es válido (debe ser entre 1 y 10)`)
    }
  }

  if (errores.length > 0) {
    erroresImport.value = errores
    modalErroresVisible.value = true
    if (inputArchivo.value) inputArchivo.value.value = ''
    return
  }

  let creados = 0
  for (const fila of filas) {
    const codigo = fila['codigo'].toString().trim()
    const nombre = fila['nombre'].toString().trim()
    const semestre = fila['semestre'].toString().trim()
    const dia = fila['dia'].toString().trim()
    const hora = fila['hora'].toString().trim()
    const profesor = fila['profesor'].toString().trim()

    try {
      await setDoc(doc(db, 'materias', codigo), { codigo, nombre, semestre, dia, hora, profesor })
      materias.value.push({ id: codigo, codigo, nombre, semestre, dia, hora, profesor })
      creados++
    } catch (e) {
      console.error(`Error con código ${codigo}:`, e)
    }
  }

  if (inputArchivo.value) inputArchivo.value.value = ''
  mostrarToastImport(creados)
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
            placeholder="Buscar por nombre, código o profesor..."
          />
          <button v-if="busqueda" type="button" class="search-clear" aria-label="Limpiar búsqueda" @click="busqueda = ''">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="command-actions">
          <input ref="inputArchivo" type="file" accept=".xlsx,.xls,.csv" class="file-input-hidden" @change="importarArchivo"/>
          <button type="button" class="btn btn-outline" @click="abrirGuiaImportacion">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Importar Excel
          </button>
          <button type="button" class="btn btn-primary" @click="abrirModalCrear">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nueva materia
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
        <span>Cargando materias...</span>
      </div>

      <div v-else class="table-card">
        <div class="table-card-header">
          <div>
            <h2 class="table-title">Lista de materias</h2>
            <p class="table-subtitle">
              {{ materiasFiltradas.length }} resultado{{ materiasFiltradas.length === 1 ? '' : 's' }}
              <template v-if="busqueda.trim()"> para «{{ busqueda }}»</template>
            </p>
          </div>
        </div>

        <div v-if="materiasFiltradas.length === 0" class="empty-panel">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <p class="empty-title">No se encontraron materias</p>
          <p class="empty-desc">Prueba otro filtro o crea una materia nueva.</p>
          <button type="button" class="btn btn-primary btn-sm" @click="abrirModalCrear">Nueva materia</button>
        </div>

        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Semestre</th>
                <th>Día</th>
                <th>Hora</th>
                <th>Profesor</th>
                <th class="th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="materia in materiasPaginadas"
                :key="materia.id"
                class="row-clickable"
                @click="verDetalleMateria(materia)"
              >
                <td><span class="code-badge">{{ materia.codigo }}</span></td>
                <td>{{ materia.nombre }}</td>
                <td><span class="semestre-badge">Sem. {{ materia.semestre }}</span></td>
                <td>{{ materia.dia }}</td>
                <td>
                  <span class="hora-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {{ materia.hora }}
                  </span>
                </td>
                <td>{{ materia.profesor }}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="action-btn" aria-label="Editar" title="Editar" @click.stop="abrirModalEditar(materia)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                      </svg>
                    </button>
                    <button type="button" class="action-btn danger" aria-label="Eliminar" title="Eliminar" @click.stop="eliminarMateria(materia)">
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

        <div v-if="materiasFiltradas.length > 0" class="table-footer">
          <span>
            {{ materiasFiltradas.length }} materia{{ materiasFiltradas.length === 1 ? '' : 's' }}
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

    <ExcelImportGuideModal
      :open="modalImportGuideVisible"
      variant="materias"
      @close="cerrarGuiaImportacion"
      @continue="continuarImportacion"
    />

    <!-- MODAL CREAR / EDITAR -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalVisible" class="modal-overlay" @click.self="cerrarModal">
          <div class="modal-card modal-form" role="dialog" aria-modal="true">
            <div class="modal-top">
              <div class="modal-top-row">
                <div class="modal-icon modal-icon--book">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                </div>
                <div class="modal-top-text">
                  <h2 class="modal-title">{{ modalModo === 'crear' ? 'Nueva materia' : 'Editar materia' }}</h2>
                  <p class="modal-subtitle">{{ modalModo === 'crear' ? 'Completa los datos de la materia' : 'Modifica los datos de la materia' }}</p>
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
                <h3 class="modal-section-title">Información general</h3>
                <div class="modal-fields-grid">
                  <div class="field-group">
                    <label class="field-label" for="materia-codigo">Código</label>
                    <input
                      id="materia-codigo"
                      v-model="formMateria.codigo"
                      class="field-input field-mono"
                      placeholder="Ej: MAT101"
                      :disabled="modalModo === 'editar'"
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="materia-semestre">Semestre</label>
                    <div class="select-wrapper">
                      <select id="materia-semestre" v-model="formMateria.semestre" class="field-input field-select">
                        <option value="" disabled>Semestre</option>
                        <option v-for="s in semestres" :key="s" :value="s">Semestre {{ s }}</option>
                      </select>
                      <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                  <div class="field-group field-group-full">
                    <label class="field-label" for="materia-nombre">Nombre de la materia</label>
                    <input id="materia-nombre" v-model="formMateria.nombre" class="field-input" placeholder="Ej: Cálculo Diferencial"/>
                  </div>
                </div>
              </section>

              <section class="modal-section">
                <h3 class="modal-section-title">Horario y docente</h3>
                <div class="field-group field-group-full">
                  <label class="field-label" for="materia-profesor">Profesor</label>
                  <div class="select-wrapper">
                    <select id="materia-profesor" v-model="formMateria.profesor" class="field-input field-select">
                      <option value="" disabled>Selecciona un profesor</option>
                      <option v-for="docente in docentes" :key="docente.id" :value="docente.nombre">
                        {{ docente.nombre }}
                      </option>
                    </select>
                    <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field-group">
                    <label class="field-label" for="materia-dia">Día</label>
                    <div class="select-wrapper">
                      <select id="materia-dia" v-model="formMateria.dia" class="field-input field-select">
                        <option value="" disabled>Selecciona</option>
                        <option v-for="d in dias" :key="d" :value="d">{{ d }}</option>
                      </select>
                      <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="materia-hora">Hora</label>
                    <input id="materia-hora" v-model="formMateria.hora" class="field-input" type="time"/>
                  </div>
                </div>
              </section>
            </div>

            <div class="modal-footer modal-footer-actions">
              <button type="button" class="btn btn-secondary" @click="cerrarModal">Cancelar</button>
              <button type="button" class="btn btn-primary" @click="guardarMateria">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {{ modalModo === 'crear' ? 'Crear materia' : 'Guardar cambios' }}
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
                  <h2 class="modal-title">Eliminar materia</h2>
                  <p class="modal-subtitle">Esta acción no se puede deshacer</p>
                </div>
              </div>
            </div>
            <div class="modal-body modal-body--compact">
              <p class="confirm-text">
                ¿Seguro que quieres eliminar
                <strong>{{ materiaAEliminar?.nombre }}</strong>
                ({{ materiaAEliminar?.codigo }})?
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

    <!-- MODAL ERRORES IMPORTACIÓN -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalErroresVisible" class="modal-overlay" @click.self="modalErroresVisible = false">
          <div class="modal-card modal-form" role="dialog" aria-modal="true">
            <div class="modal-top">
              <div class="modal-top-row">
                <div class="modal-icon modal-icon--warning">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div class="modal-top-text">
                  <h2 class="modal-title">Error en el archivo</h2>
                  <p class="modal-subtitle">No se importó ninguna materia. Corrige los siguientes errores:</p>
                </div>
                <button type="button" class="modal-close" aria-label="Cerrar" @click="modalErroresVisible = false">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="modal-body modal-body--compact">
              <ul class="error-list">
                <li v-for="(error, i) in erroresImport" :key="i" class="error-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {{ error }}
                </li>
              </ul>
            </div>
            <div class="modal-footer modal-footer-actions">
              <button type="button" class="btn btn-primary" @click="modalErroresVisible = false">Entendido</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- TOAST ELIMINACIÓN -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastVisible" class="toast toast--success">
          <div class="toast-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
          <span>Materia eliminada exitosamente</span>
        </div>
      </Transition>
    </Teleport>

    <!-- TOAST GUARDADO -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastGuardadoVisible" class="toast toast--success" style="bottom: 88px">
          <div class="toast-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
          <span>Materia guardada exitosamente</span>
        </div>
      </Transition>
    </Teleport>

    <!-- TOAST IMPORTACIÓN -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastImportVisible" class="toast toast--success" style="bottom: 148px">
          <div class="toast-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
          <span>{{ importCount }} materia(s) importadas exitosamente</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.code-badge {
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-border-light);
  color: var(--color-text);
  padding: 3px 8px;
  border-radius: 6px;
}

.semestre-badge {
  font-size: 11px;
  font-weight: 500;
  background: var(--color-warning-bg);
  color: var(--color-warning);
  padding: 3px 10px;
  border-radius: 20px;
}

.hora-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-info-bg);
  color: var(--color-info);
  padding: 3px 10px;
  border-radius: 20px;
}

.toast {
  position: fixed; bottom: 28px; right: 28px; z-index: 2000;
  display: flex; align-items: center; gap: 12px;
  background: #111827; color: white;
  padding: 14px 20px; border-radius: 12px;
  font-size: 13px; font-weight: 500;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.toast--success .toast-icon { background: #10b981; }
.toast-icon {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px) scale(0.95); }
</style>