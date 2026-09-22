<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { db } from '@/lib/firebase'
import { sanitizarUsuario } from '@/lib/autenticacion/usuarioSeguro'
import { labelRol } from '@/lib/nucleo/roles'
import TableDetailModal from '@/componentes/modales/TableDetailModal.vue'
import { buildDetailFields } from '@/lib/nucleo/tableDetail'
import { collection, getDocs } from 'firebase/firestore'

const PAGE_SIZE = 20

const activeFilter = ref('todos')
const busqueda = ref('')
const paginaActual = ref(1)
const usuarios = ref<any[]>([])
const loading = ref(true)
const errorCarga = ref('')

const slugRol = (rol: string) => rol?.toLowerCase().replace(/\s+/g, '-') || ''

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

const cargarUsuarios = async () => {
  errorCarga.value = ''
  loading.value = true
  try {
    const querySnapshot = await getDocs(collection(db, 'usuarios'))
    usuarios.value = querySnapshot.docs.map(docSnap =>
      sanitizarUsuario(docSnap.data() as Record<string, unknown>, docSnap.id),
    )
  } catch (e) {
    console.error(e)
    usuarios.value = []
    errorCarga.value =
      'No se pudieron cargar los usuarios. Verifica tu conexión e intenta nuevamente.'
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

</script>

<template>
  <div class="representante-list-page">

    <section class="command-bar">

      <div class="command-row">

        <div class="search-box">

          <svg
            class="search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>


          <input
            v-model="busqueda"
            class="search-input"
            type="search"
            placeholder="Buscar por nombre, correo o cédula..."
          />


          <button
            v-if="busqueda"
            type="button"
            class="search-clear"
            aria-label="Limpiar búsqueda"
            @click="limpiarBusqueda"
          >

            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>

          </button>

        </div>

      </div>


      <div class="filter-row">

        <button
          v-for="filtro in filtros"
          :key="filtro.id"
          type="button"
          :class="[
            'filter-chip',
            { active: activeFilter === filtro.id }
          ]"
          @click="activeFilter = filtro.id"
        >
          {{ filtro.label }}

        </button>

      </div>


    </section>



    <!-- TABLA -->

    <section class="table-section">


      <div
        v-if="loading"
        class="loading-state"
      >

        <div class="spinner"></div>

        <span>
          Cargando usuarios...
        </span>

      </div>



      <div
        v-else
        class="table-card"
      >


        <div class="table-card-header">

          <div>

            <h2 class="table-title">
              Lista de usuarios
            </h2>


            <p class="table-subtitle">

              {{ usuarios.length }} en el sistema ·

              {{ usuariosFiltrados.length }}
              resultado{{ usuariosFiltrados.length === 1 ? '' : 's' }}

              <template v-if="busqueda.trim()">
                para «{{ busqueda }}»
              </template>

            </p>


          </div>


        </div>




        <!-- ERROR -->

        <div
          v-if="errorCarga"
          class="empty-panel"
        >

          <p class="empty-title">
            Error al cargar usuarios
          </p>


          <p class="empty-desc">
            {{ errorCarga }}
          </p>


          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="cargarUsuarios"
          >
            Reintentar
          </button>


        </div>




        <!-- TABLA -->

        <div
          v-else-if="usuariosFiltrados.length > 0"
          class="table-wrap"
        >


          <table class="data-table">


            <thead>

              <tr>

                <th>
                  Usuario
                </th>

                <th>
                  Cédula
                </th>

                <th>
                  Correo
                </th>

                <th>
                  Rol
                </th>

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


                    <div
                      :class="[
                        'user-avatar',
                        slugRol(usuario.rol)
                      ]"
                    >

                      {{ inicialesDe(usuario.nombre) }}

                    </div>



                    <span class="user-name">

                      {{ usuario.nombre }}

                    </span>


                  </div>


                </td>




                <td>

                  <span class="cedula-cell">

                    {{ usuario.cedula }}

                  </span>

                </td>




                <td>

                  <span class="email-cell">

                    {{ usuario.correo }}

                  </span>

                </td>




                <td>

                  <span
                    :class="[
                      'status-badge',
                      slugRol(usuario.rol)
                    ]"
                  >

                    {{ labelRol(usuario.rol) }}

                  </span>


                </td>



              </tr>



            </tbody>



          </table>



        </div>





        <!-- SIN RESULTADOS -->

        <div
          v-else
          class="empty-panel"
        >

          <p class="empty-title">
            No se encontraron usuarios
          </p>


          <p class="empty-desc">
            Prueba cambiando el filtro o la búsqueda.
          </p>


        </div>






        <!-- PAGINACION -->


        <div
          v-if="usuariosFiltrados.length > 0"
          class="table-footer"
        >


          <span>

            {{ usuariosFiltrados.length }}

            usuario{{ usuariosFiltrados.length === 1 ? '' : 's' }}

            · Página {{ paginaActual }}

            de {{ totalPaginas }}


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





    <!-- DETALLE -->

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
.representante-list-page {
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
