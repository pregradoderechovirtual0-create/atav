<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { db } from '@/lib/firebase'
import { collection, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { dialog } from '@/lib/dialog'
import {
  existeClaveAutorizacionJefa,
  verificarClaveAutorizacionJefa,
  establecerClaveAutorizacionJefa,
} from '@/lib/claves'
import { sanitizarUsuario } from '@/lib/usuarioSeguro'
import { labelRol, ROL_JEFA_SUPREMA } from '@/lib/roles'
import TableDetailModal from '@/components/TableDetailModal.vue'
import ExcelImportGuideModal from '@/components/ExcelImportGuideModal.vue'
import { buildDetailFields } from '@/lib/tableDetail'

const PAGE_SIZE = 20

const activeFilter = ref('todos')
const busqueda = ref('')
const paginaActual = ref(1)
const usuarios = ref<any[]>([])
const loading = ref(true)

// Modal de edición
const modalVisible = ref(false)
const usuarioEditando = ref<any>(null)
const formEdicion = ref({ cedula: '', nombre: '', correo: '', rol: '' })
const claveAutorizacionJefa = ref('')

const requiereClaveJefa = computed(() =>
  formEdicion.value.rol === ROL_JEFA_SUPREMA && usuarioEditando.value?.rol !== ROL_JEFA_SUPREMA
)

const guardandoEdicion = ref(false)

const inicialesUsuario = computed(() => {
  const nombre = formEdicion.value.nombre?.trim()
  if (!nombre) return '?'
  const partes = nombre.split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return partes[0][0].toUpperCase()
})

const slugRol = (rol: string) => rol?.toLowerCase().replace(/\s+/g, '-') || ''

const rolesOpciones = [
  { id: 'Docente', label: 'Docente', desc: 'Solicitudes y materias asignadas' },
  { id: 'Estudiante', label: 'Estudiante', desc: 'Flexibilización, supletorios y más' },
  { id: 'Director', label: 'Practicante', desc: 'Gestión y aprobación del programa' },
  { id: ROL_JEFA_SUPREMA, label: 'Directora', desc: 'Acceso total y configuración' },
] as const

const seleccionarRol = (rol: string) => {
  formEdicion.value.rol = rol
  if (rol !== ROL_JEFA_SUPREMA) claveAutorizacionJefa.value = ''
}

const modalConfirmVisible = ref(false)
const usuarioAEliminar = ref<any>(null)

const detalleVisible = ref(false)
const detalleTitle = ref('')
const detalleSubtitle = ref('')
const detalleFields = ref<{ label: string; value: string; href?: string }[]>([])

const verDetalleUsuario = (usuario: any) => {
  detalleTitle.value = usuario.nombre || 'Usuario'
  detalleSubtitle.value = labelRol(usuario.rol)
  detalleFields.value = buildDetailFields(usuario, [
    { key: 'nombre', label: 'Nombre completo' },
    { key: 'cedula', label: 'Cédula' },
    { key: 'correo', label: 'Correo' },
    { key: 'rol', label: 'Rol' },
    { key: 'celular', label: 'Celular' },
    { key: 'registrado', label: 'Cuenta activada' },
  ])
  detalleVisible.value = true
}

// Toast eliminación
const toastVisible = ref(false)
let toastTimeout: ReturnType<typeof setTimeout>

// Toast importación
const toastImportVisible = ref(false)
const importCount = ref(0)
let toastImportTimeout: ReturnType<typeof setTimeout>

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


const cargarUsuarios = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'usuarios'))
    usuarios.value = querySnapshot.docs.map(docSnap =>
      sanitizarUsuario(docSnap.data() as Record<string, unknown>, docSnap.id),
    )
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(cargarUsuarios)

const filtros = [
  { id: 'todos', label: 'Todos' },
  { id: 'docente', label: 'Docentes' },
  { id: 'estudiante', label: 'Estudiantes' },
  { id: 'director', label: 'Practicantes' },
]

const inicialesDe = (nombre: string) => {
  const n = nombre?.trim()
  if (!n) return '?'
  const partes = n.split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return partes[0][0].toUpperCase()
}

const limpiarBusqueda = () => {
  busqueda.value = ''
}


const usuariosFiltrados = computed(() => {
  let lista = usuarios.value

  if (activeFilter.value !== 'todos') {
    if (activeFilter.value === 'director') {
      lista = lista.filter(u => u.rol === 'Director' || u.rol === 'Jefa Suprema')
    } else {
      lista = lista.filter(u =>
        u.rol?.toLowerCase() === activeFilter.value.toLowerCase()
      )
    }
  }

  if (busqueda.value.trim()) {
    const texto = busqueda.value.toLowerCase()
    lista = lista.filter(u =>
      u.nombre?.toLowerCase().includes(texto) ||
      u.correo?.toLowerCase().includes(texto) ||
      u.cedula?.toString().includes(texto)
    )
  }

  return lista
})

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(usuariosFiltrados.value.length / PAGE_SIZE))
)

const usuariosPaginados = computed(() => {
  const inicio = (paginaActual.value - 1) * PAGE_SIZE
  return usuariosFiltrados.value.slice(inicio, inicio + PAGE_SIZE)
})

watch([activeFilter, busqueda], () => {
  paginaActual.value = 1
})

const irPagina = (pagina: number) => {
  if (pagina < 1 || pagina > totalPaginas.value) return
  paginaActual.value = pagina
}


// --- Edición ---
const abrirModal = (usuario: any) => {
  usuarioEditando.value = usuario
  formEdicion.value = {
    cedula: usuario.cedula?.toString() || '',
    nombre: usuario.nombre?.toString() || '',
    correo: (usuario.correo || usuario.email || '').toString(),
    rol: usuario.rol?.toString() || '',
  }
  claveAutorizacionJefa.value = ''
  modalVisible.value = true
}

const cerrarModal = () => {
  modalVisible.value = false
  usuarioEditando.value = null
  claveAutorizacionJefa.value = ''
}

const guardarEdicion = async () => {
  const { cedula, nombre, correo, rol } = formEdicion.value
  if (!nombre || !correo || !rol) return

  if (requiereClaveJefa.value) {
    if (!claveAutorizacionJefa.value.trim()) {
      await dialog.alert('Ingresa la clave de autorización para asignar el rol Directora.', { variant: 'error' })
      return
    }

    const yaConfigurada = await existeClaveAutorizacionJefa()
    try {
      if (!yaConfigurada) {
        await establecerClaveAutorizacionJefa(claveAutorizacionJefa.value)
      } else {
        const valida = await verificarClaveAutorizacionJefa(claveAutorizacionJefa.value)
        if (!valida) {
          await dialog.alert('Clave incorrecta. Solo quien conozca la clave autorizada puede asignar Directora.', { variant: 'error' })
          return
        }
      }
    } catch (e) {
      console.error(e)
      await dialog.alert(
        'No se pudo guardar la clave de autorización. Si acabas de borrar config/seguridad, despliega las reglas: npm run deploy:rules',
        { variant: 'error' },
      )
      return
    }
  }

  try {
    guardandoEdicion.value = true
    await updateDoc(doc(db, 'usuarios', usuarioEditando.value.id), { cedula, nombre, correo, rol })

    usuarioEditando.value.cedula = cedula
    usuarioEditando.value.nombre = nombre
    usuarioEditando.value.correo = correo
    usuarioEditando.value.rol = rol
    cerrarModal()
  } catch (e) {
    console.error(e)
    await dialog.alert('Error al guardar los cambios', { variant: 'error' })
  } finally {
    guardandoEdicion.value = false
  }
}

// --- Eliminación ---
const mostrarToast = () => {
  toastVisible.value = true
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toastVisible.value = false }, 3000)
}

const eliminarUsuario = (usuario: any) => {
  usuarioAEliminar.value = usuario
  modalConfirmVisible.value = true
}

const confirmarEliminacion = async () => {
  if (!usuarioAEliminar.value?.id) return

  try {
    await deleteDoc(doc(db, 'usuarios', usuarioAEliminar.value.id))
    usuarios.value = usuarios.value.filter(u => u.id !== usuarioAEliminar.value.id)
    mostrarToast()
  } catch (e) {
    console.error(e)
  } finally {
    modalConfirmVisible.value = false
    usuarioAEliminar.value = null
  }
}

const cancelarEliminacion = () => {
  modalConfirmVisible.value = false
  usuarioAEliminar.value = null
}

// --- Importar Excel/CSV ---
const mostrarToastImport = (cantidad: number) => {
  importCount.value = cantidad
  toastImportVisible.value = true
  clearTimeout(toastImportTimeout)
  toastImportTimeout = setTimeout(() => { toastImportVisible.value = false }, 4000)
}

const importarArchivo = async (event: Event) => {
  const archivo = (event.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  const data = await archivo.arrayBuffer()
  const workbook = XLSX.read(data)
  const hoja = workbook.Sheets[workbook.SheetNames[0]]
  const filas: any[] = XLSX.utils.sheet_to_json(hoja)

  // --- Validación previa (no toca Firebase todavía) ---
  const errores: string[] = []
  const rolesValidos = ['Docente', 'Estudiante', 'Director']
  const cedulasEnArchivo = new Set<string>()

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const numFila = i + 2 // fila 1 es el encabezado
    const cedula = fila['cedula']?.toString().trim()
    const nombre = fila['nombre']?.toString().trim()
    const correo = fila['correo']?.toString().trim()
    const rol = fila['rol']?.toString().trim()

    // Campos vacíos
    if (!cedula || !nombre || !correo || !rol) {
      errores.push(`Fila ${numFila}: hay campos vacíos`)
      continue
    }

    // Cédula solo números
    if (!/^\d+$/.test(cedula)) {
      errores.push(`Fila ${numFila}: la cédula "${cedula}" no es válida (solo números)`)
    }

    // Rol válido
    if (!rolesValidos.includes(rol)) {
      errores.push(`Fila ${numFila}: el rol "${rol}" no es válido (usa Docente, Estudiante o Practicante)`)
    }

    // Correo básico
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      errores.push(`Fila ${numFila}: el correo "${correo}" no tiene un formato válido`)
    }

    // Cédulas duplicadas dentro del mismo archivo
    if (cedulasEnArchivo.has(cedula)) {
      errores.push(`Fila ${numFila}: la cédula "${cedula}" está duplicada en el archivo`)
    } else {
      cedulasEnArchivo.add(cedula)
    }

    // Cédula ya existe en Firebase (lista local ya cargada)
    const yaExiste = usuarios.value.find(u => u.id === cedula)
    if (yaExiste) {
      errores.push(`Fila ${numFila}: la cédula "${cedula}" (${yaExiste.nombre}) ya está registrada`)
    }
  }

  // Si hay cualquier error, mostrar todo y no subir nada
  if (errores.length > 0) {
    await dialog.alert(`No se importó ningún usuario. Corrige los siguientes errores:\n\n${errores.join('\n')}`, {
      title: 'Errores de importación',
      variant: 'error',
    })
    if (inputArchivo.value) inputArchivo.value.value = ''
    return
  }

  // --- Todo válido: subir a Firebase ---
  let creados = 0

  for (const fila of filas) {
    const cedula = fila['cedula'].toString().trim()
    const nombre = fila['nombre'].toString().trim()
    const correo = fila['correo'].toString().trim()
    const rol = fila['rol'].toString().trim()

    try {
      const userRef = doc(db, 'usuarios', cedula)
      await setDoc(userRef, {
        cedula, nombre, correo, rol,
        registrado: false,
        createdAt: new Date()
      })

      usuarios.value.push({ id: cedula, cedula, nombre, correo, rol, registrado: false })
      creados++
    } catch (e) {
      console.error(`Error con cédula ${cedula}:`, e)
    }
  }

  if (inputArchivo.value) inputArchivo.value.value = ''
  mostrarToastImport(creados)
}
</script>

<template>
  <div class="usuarios-page">

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
            placeholder="Buscar por nombre, correo o cédula..."
          />
          <button v-if="busqueda" type="button" class="search-clear" aria-label="Limpiar búsqueda" @click="limpiarBusqueda">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="command-actions">
          <input
            ref="inputArchivo"
            type="file"
            accept=".xlsx,.xls,.csv"
            class="file-input-hidden"
            @change="importarArchivo"
          />
          <button type="button" class="btn btn-outline" @click="abrirGuiaImportacion">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Importar Excel
          </button>
          <router-link to="/director/usuarios/crear" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Crear usuario
          </router-link>
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

    <!-- Tabla -->
    <section class="table-section">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando usuarios...</span>
      </div>

      <div v-else class="table-card">
        <div class="table-card-header">
          <div>
            <h2 class="table-title">Lista de usuarios</h2>
            <p class="table-subtitle">
              {{ usuariosFiltrados.length }} resultado{{ usuariosFiltrados.length === 1 ? '' : 's' }}
              <template v-if="busqueda.trim()"> para «{{ busqueda }}»</template>
            </p>
          </div>
        </div>

        <div v-if="usuariosFiltrados.length === 0" class="empty-panel">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p class="empty-title">No se encontraron usuarios</p>
          <p class="empty-desc">Prueba otro filtro o crea un usuario nuevo.</p>
          <router-link to="/director/usuarios/crear" class="btn btn-primary btn-sm">Crear usuario</router-link>
        </div>

        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Cédula</th>
                <th>Correo</th>
                <th>Rol</th>
                <th class="th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="usuario in usuariosPaginados"
                :key="usuario.id"
                class="row-clickable"
                @click="verDetalleUsuario(usuario)"
              >
                <td>
                  <div class="user-cell">
                    <div :class="['user-avatar', slugRol(usuario.rol)]">
                      {{ inicialesDe(usuario.nombre) }}
                    </div>
                    <span class="user-name">{{ usuario.nombre }}</span>
                  </div>
                </td>
                <td><span class="cedula-cell">{{ usuario.cedula }}</span></td>
                <td><span class="email-cell">{{ usuario.correo }}</span></td>
                <td>
                  <span :class="['status-badge', slugRol(usuario.rol)]">{{ labelRol(usuario.rol) }}</span>
                </td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="action-btn" aria-label="Editar" title="Editar" @click.stop="abrirModal(usuario)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                      </svg>
                    </button>
                    <button type="button" class="action-btn danger" aria-label="Eliminar" title="Eliminar" @click.stop="eliminarUsuario(usuario)">
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

        <div v-if="usuariosFiltrados.length > 0" class="table-footer">
          <span>
            {{ usuariosFiltrados.length }} usuario{{ usuariosFiltrados.length === 1 ? '' : 's' }}
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
      variant="usuarios"
      @close="cerrarGuiaImportacion"
      @continue="continuarImportacion"
    />

    <!-- MODAL EDICIÓN -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalVisible" class="modal-overlay" @click.self="cerrarModal">
          <div class="modal-card modal-edit" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
            <div class="modal-top">
              <div class="modal-top-row">
                <div :class="['modal-avatar', slugRol(formEdicion.rol)]">
                  {{ inicialesUsuario }}
                </div>
                <div class="modal-top-text">
                  <h2 id="edit-user-title" class="modal-title">Editar usuario</h2>
                  <p class="modal-subtitle">{{ formEdicion.correo || 'Sin correo registrado' }}</p>
                </div>
                <button type="button" class="modal-close" aria-label="Cerrar" @click="cerrarModal">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <span v-if="formEdicion.rol" :class="['modal-rol-badge', slugRol(formEdicion.rol)]">
                {{ labelRol(formEdicion.rol) }}
              </span>
            </div>

            <div class="modal-body">
              <section class="modal-section">
                <h3 class="modal-section-title">Información personal</h3>
                <div class="modal-fields-grid">
                  <div class="field-group">
                    <label class="field-label" for="edit-cedula">Cédula</label>
                    <input
                      id="edit-cedula"
                      v-model="formEdicion.cedula"
                      class="field-input field-mono"
                      inputmode="numeric"
                    />
                  </div>
                  <div class="field-group field-group-wide">
                    <label class="field-label" for="edit-nombre">Nombre completo</label>
                    <input
                      id="edit-nombre"
                      v-model="formEdicion.nombre"
                      class="field-input"
                      placeholder="Nombre y apellidos"
                    />
                  </div>
                  <div class="field-group field-group-full">
                    <label class="field-label" for="edit-correo">Correo electrónico</label>
                    <input
                      id="edit-correo"
                      v-model="formEdicion.correo"
                      type="email"
                      class="field-input"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </div>
              </section>

              <section class="modal-section">
                <h3 class="modal-section-title">Rol en el sistema</h3>
                <div class="rol-grid">
                  <button
                    v-for="opcion in rolesOpciones"
                    :key="opcion.id"
                    type="button"
                    :class="['rol-card', slugRol(opcion.id), { active: formEdicion.rol === opcion.id }]"
                    @click="seleccionarRol(opcion.id)"
                  >
                    <span class="rol-card-label">{{ opcion.label }}</span>
                    <span class="rol-card-desc">{{ opcion.desc }}</span>
                    <span v-if="formEdicion.rol === opcion.id" class="rol-card-check" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                  </button>
                </div>

                <Transition name="jefa-panel">
                  <div v-if="requiereClaveJefa" class="jefa-auth-panel">
                    <div class="jefa-auth-header">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <div>
                        <p class="jefa-auth-title">Autorización requerida</p>
                        <p class="jefa-auth-desc">
                          Ingresa la clave para asignar Directora. La primera vez quedará guardada en el sistema.
                        </p>
                      </div>
                    </div>
                    <input
                      v-model="claveAutorizacionJefa"
                      type="password"
                      class="field-input"
                      placeholder="Clave de autorización"
                      autocomplete="off"
                    />
                  </div>
                </Transition>
              </section>
            </div>

            <div class="modal-footer modal-footer-edit">
              <router-link
                v-if="usuarioEditando"
                :to="`/director/restablecer-password/${usuarioEditando.id}`"
                class="btn-reset-link"
                @click="cerrarModal"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
                Restablecer contraseña
              </router-link>

              <div class="actions-right">
                <button type="button" class="btn btn-secondary" :disabled="guardandoEdicion" @click="cerrarModal">
                  Cancelar
                </button>
                <button type="button" class="btn btn-primary" :disabled="guardandoEdicion" @click="guardarEdicion">
                  {{ guardandoEdicion ? 'Guardando...' : 'Guardar cambios' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
  <Transition name="modal">
    <div v-if="modalConfirmVisible" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">Eliminar usuario</h2>
        </div>

        <div class="modal-body">
          <p style="font-size:13px; color: var(--color-text-secondary);">
            ¿Seguro que quieres eliminar al usuario 
            <strong>{{ usuarioAEliminar?.nombre }}</strong>?
          </p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="cancelarEliminacion">
            Cancelar
          </button>
          <button class="btn btn-primary" @click="confirmarEliminacion">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  </Transition>
</Teleport>

    <!-- TOAST ELIMINACIÓN -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastVisible" class="toast-success">
          <div class="toast-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span>Se ha eliminado exitosamente</span>
        </div>
      </Transition>
    </Teleport>

    <!-- TOAST IMPORTACIÓN -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastImportVisible" class="toast-import">
          <div class="toast-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span>{{ importCount }} usuario(s) importados exitosamente</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.usuarios-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
}

/* Command bar */
.command-bar {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--shadow-xs);
}

.command-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 220px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 42px;
  padding: 0 40px 0 42px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-subtle);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
}

.search-input:focus {
  background: var(--color-surface);
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.search-input::placeholder { color: var(--color-text-muted); }

.search-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: all var(--transition);
}

.search-clear:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

.command-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.file-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-subtle);
  border: 1px solid transparent;
  transition: all var(--transition);
}

.filter-chip:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-surface);
}

.filter-chip.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-lg);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition);
  border: none;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}

.btn-sm {
  padding: 8px 14px;
  font-size: 12px;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-light);
}

.btn-outline {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-outline:hover {
  background: var(--color-subtle);
  border-color: var(--color-text-muted);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-subtle);
  border-color: var(--color-text-muted);
}

.btn-ghost {
  background: var(--color-subtle);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-ghost:hover { background: var(--color-border-light); }

/* Table section */
.table-section { min-height: 200px; }

.table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-xs);
}

.table-card-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-border-light);
}

.table-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.table-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.data-table th {
  padding: 12px 20px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-subtle);
  border-bottom: 1px solid var(--color-border-light);
}

.th-actions { text-align: right; }

.data-table th:nth-child(1) { width: 30%; }
.data-table th:nth-child(2) { width: 16%; }
.data-table th:nth-child(3) { width: 32%; }
.data-table th:nth-child(4) { width: 16%; }
.data-table th:nth-child(5) { width: 12%; }

.data-table td {
  padding: 14px 16px;
  font-size: 13px;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-table tbody tr {
  transition: background var(--transition);
}

.data-table tbody tr.row-clickable {
  cursor: pointer;
}

.data-table tbody tr.row-clickable:hover {
  background: var(--color-subtle);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  background: var(--color-primary);
}

.user-avatar.docente { background: #3b82f6; }
.user-avatar.estudiante { background: #10b981; }
.user-avatar.director { background: #f59e0b; }
.user-avatar.jefa-suprema { background: #be185d; }

.user-name {
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cedula-cell {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.email-cell {
  color: var(--color-text-secondary);
  font-size: 13px;
  word-break: break-all;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.docente { background: var(--color-info-bg); color: var(--color-info); }
.status-badge.estudiante { background: var(--color-success-bg); color: var(--color-success); }
.status-badge.director { background: var(--color-warning-bg); color: var(--color-warning); }
.status-badge.jefa-suprema { background: #fdf2f8; color: #9d174d; }

.table-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--color-border-light);
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.pagination-controls {
  display: flex;
  gap: 8px;
}

.page-nav {
  padding: 6px 12px;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: all var(--transition);
}

.page-nav:hover:not(:disabled) {
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.page-nav:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.row-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.action-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: all var(--transition);
  background: transparent;
}

.action-btn:hover {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.action-btn.danger:hover {
  background: var(--color-error-bg);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-error);
}

.empty-panel {
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-subtle);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.empty-desc {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--color-text-muted);
  font-size: 13px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .command-row {
    flex-direction: column;
    align-items: stretch;
  }

  .command-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 640px) {
  .command-actions {
    flex-direction: column;
    width: 100%;
  }

  .command-actions .btn {
    width: 100%;
    justify-content: center;
  }

  .data-table th:nth-child(3),
  .data-table td:nth-child(3) {
    display: none;
  }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  width: 100%;
  max-width: 460px;
  overflow: hidden;
}

.modal-edit {
  max-width: 520px;
}

.modal-top {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--color-border-light);
  background: var(--color-surface);
}

.modal-top-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.modal-top-text {
  flex: 1;
  min-width: 0;
}

.modal-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  color: white;
  background: var(--color-primary);
}

.modal-avatar.docente { background: #3b82f6; }
.modal-avatar.estudiante { background: #10b981; }
.modal-avatar.director { background: #f59e0b; }
.modal-avatar.jefa-suprema { background: #be185d; }

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  line-height: 1.3;
}

.modal-subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 4px 0 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-rol-badge {
  display: inline-flex;
  margin-top: 12px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.modal-rol-badge.docente { background: var(--color-info-bg); color: var(--color-info); }
.modal-rol-badge.estudiante { background: var(--color-success-bg); color: var(--color-success); }
.modal-rol-badge.director { background: var(--color-warning-bg); color: var(--color-warning); }
.modal-rol-badge.jefa-suprema { background: #fdf2f8; color: #9d174d; }

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  cursor: pointer;
  background: var(--color-surface);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  flex-shrink: 0;
}

.modal-close:hover {
  background: var(--color-subtle);
  color: var(--color-text);
}
.modal-divider { height: 1px; background: var(--color-border-light); }
.modal-body { padding: 20px 24px 8px; display: flex; flex-direction: column; gap: 20px; }
.modal-section { display: flex; flex-direction: column; gap: 12px; }
.modal-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin: 0;
}
.modal-fields-grid {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 12px 14px;
}
.field-group-wide { grid-column: span 1; }
.field-group-full { grid-column: 1 / -1; }
.field-mono { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.field-with-icon { position: relative; }
.field-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}
.field-input-icon { padding-left: 38px; }
.rol-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.rol-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-subtle);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition);
}

.rol-card:hover {
  border-color: var(--color-text-muted);
  background: var(--color-surface);
}

.rol-card.active {
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 12%, transparent);
}
.rol-card.active.docente,
.rol-card.active.estudiante,
.rol-card.active.director,
.rol-card.active.jefa-suprema {
  border-color: var(--color-primary);
  background: var(--color-surface);
}

.rol-card-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.rol-card-desc {
  font-size: 11px;
  line-height: 1.35;
  color: var(--color-text-muted);
  padding-right: 20px;
}

.rol-card-check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.jefa-auth-panel {
  margin-top: 4px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid #fbcfe8;
  background: #fdf2f8;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.jefa-auth-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  color: #9d174d;
}
.jefa-auth-title {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 600;
  color: #831843;
}
.jefa-auth-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: #9d174d;
}
.jefa-panel-enter-active,
.jefa-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.jefa-panel-enter-from,
.jefa-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--color-text); }
.field-input {
  padding: 10px 14px; border-radius: 8px; border: 1.5px solid var(--color-border);
  background: var(--color-surface); color: var(--color-text);
  font-size: 13px; width: 100%; box-sizing: border-box;
  outline: none; transition: border-color var(--transition), box-shadow var(--transition);
}
.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}
.modal-footer-edit {
  padding: 16px 20px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-subtle);
}
.btn-reset-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #b45309;
  text-decoration: none;
  border: 1px solid #fde68a;
  background: #fffbeb;
  transition: all 0.18s ease;
}
.btn-reset-link:hover {
  background: #fef3c7;
  color: #92400e;
  border-color: #fcd34d;
}
@media (max-width: 560px) {
  .modal-fields-grid { grid-template-columns: 1fr; }
  .field-group-wide,
  .field-group-full { grid-column: auto; }
  .rol-grid { grid-template-columns: 1fr; }
  .modal-footer-edit { flex-direction: column; align-items: stretch; }
  .actions-right { width: 100%; }
  .actions-right .btn { flex: 1; justify-content: center; }
  .btn-reset-link { justify-content: center; }
}

.toast-success, .toast-import {
  position: fixed; bottom: 28px; right: 28px; z-index: 2000;
  display: flex; align-items: center; gap: 12px;
  background: #111827; color: white;
  padding: 14px 20px; border-radius: 12px;
  font-size: 13px; font-weight: 500;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.toast-import { bottom: 88px; }

.toast-icon {
  width: 28px; height: 28px; border-radius: 50%;
  background: #10b981;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.loading-state {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; padding: 60px 20px;
  color: var(--color-text-muted); font-size: 13px;
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .modal-card,
.modal-leave-active .modal-card { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card, .modal-leave-to .modal-card { transform: scale(0.95) translateY(8px); opacity: 0; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px) scale(0.95); }

.action-btn.reset:hover {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.modal-footer { padding: 16px 24px 24px; display: flex; justify-content: flex-end; gap: 10px; }

.actions-right {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

</style>
