<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { auth, db } from '@/lib/firebase'
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  query, orderBy, where, serverTimestamp
} from 'firebase/firestore'
import { fetchMaterias, filtrarMateriasPorProfesor, type MateriaRegistrada } from '@/lib/dominio/materias'
import { mapDocSolicitud, eventosCalendarioDesdeSolicitud } from '@/lib/solicitudes/docenteSolicitudes'
import { dialog } from '@/lib/nucleo/dialog'

const rol = localStorage.getItem('rol') || ''
const esDirector = rol === 'Director' || rol === 'Jefa Suprema'
const esDocente = rol === 'Docente'
const nombreUsuario = localStorage.getItem('nombre') || ''

const hoy = new Date()
const mesActual = ref(hoy.getMonth())
const anioActual = ref(hoy.getFullYear())

const nombresMes = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const diaSemanaMap: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3,
  'jueves': 4, 'viernes': 5, 'sabado': 6,
}

const normalizarDia = (dia: string) =>
  dia.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const periodosNoLectivos = ref<any[]>([])

const enPeriodoNoLectivo = (fechaStr: string) =>
  periodosNoLectivos.value.some(p => fechaStr >= p.inicio && fechaStr <= p.fin)

const eventos = ref<any[]>([])
const materias = ref<MateriaRegistrada[]>([])
const loading = ref(true)

const materiasVisibles = computed(() => {
  if (esDocente) return filtrarMateriasPorProfesor(materias.value, nombreUsuario)
  return materias.value
})

const modalVisible = ref(false)
const diaSeleccionado = ref<number | null>(null)
const eventosDiaSeleccionado = ref<any[]>([])
const modalCrear = ref(false)
const formEvento = ref({ titulo: '', descripcion: '', tipo: 'general' })

const toastVisible = ref(false)
const toastMensaje = ref('')
let toastTimeout: ReturnType<typeof setTimeout>

const mostrarToast = (msg: string) => {
  toastMensaje.value = msg
  toastVisible.value = true
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toastVisible.value = false }, 3000)
}

const cargarEventos = async () => {
  loading.value = true
  try {
    const uid = auth.currentUser?.uid

    const snapEventos = await getDocs(query(collection(db, 'eventos'), orderBy('fecha', 'asc')))
    const materiasData = await fetchMaterias()

    let snapFlex = { docs: [] as any[] }
    let snapSolicitudes = { docs: [] as any[] }
    let snapPeriodos = { docs: [] as any[] }

    if (esDirector) {
      const [flex, solicitudes, periodos] = await Promise.all([
        getDocs(collection(db, 'flexibilizaciones')),
        getDocs(collection(db, 'solicitudes')),
        getDocs(collection(db, 'periodosNoLectivos')),
      ])
      snapFlex = flex
      snapSolicitudes = solicitudes
      snapPeriodos = periodos
    } else if (esDocente && uid) {
      const [solicitudes, periodos] = await Promise.all([
        getDocs(query(collection(db, 'solicitudes'), where('usuario_id', '==', uid))),
        getDocs(collection(db, 'periodosNoLectivos')).catch(() => ({ docs: [] })),
      ])
      snapSolicitudes = solicitudes
      snapPeriodos = periodos
    } else if (uid) {
      snapFlex = await getDocs(
        query(collection(db, 'flexibilizaciones'), where('estudiante_id', '==', uid)),
      )
      try {
        snapPeriodos = await getDocs(collection(db, 'periodosNoLectivos'))
      } catch {
        snapPeriodos = { docs: [] }
      }
    }

    materias.value = materiasData
    periodosNoLectivos.value = snapPeriodos.docs.map(d => ({ id: d.id, ...d.data() }))

    const manuales = snapEventos.docs.map(d => ({ id: d.id, ...d.data(), origen: 'manual' }))

    const flex = snapFlex.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((f: any) => f.fecha_parcial)
      .map((f: any) => ({
        id: `flex-${f.id}`,
        titulo: `Flexibilización: ${f.curso || 'Sin curso'}`,
        descripcion: `Estudiante: ${f.nombre || ''} — Parcial ${f.parcial || ''}`,
        fecha: f.fecha_parcial,
        tipo: 'flexibilizacion',
        origen: 'auto'
      }))

    const solicitudesDocente = snapSolicitudes.docs.map(d => mapDocSolicitud(d.id, d.data()))
    const eventosSolicitudes = solicitudesDocente
      .flatMap(eventosCalendarioDesdeSolicitud)
      .map(e => ({
        id: e.id,
        titulo: e.titulo,
        descripcion: e.motivoRechazo ? `${e.descripcion} — Rechazo: ${e.motivoRechazo}` : e.descripcion,
        fecha: e.fecha,
        tipo: `solicitud-${e.estado}`,
        origen: 'auto',
      }))

    eventos.value = [...manuales, ...flex, ...eventosSolicitudes]
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(cargarEventos)

const diasDelMes = computed(() => {
  const primero = new Date(anioActual.value, mesActual.value, 1)
  const ultimo = new Date(anioActual.value, mesActual.value + 1, 0)
  const diasTotales = ultimo.getDate()

  let inicioSemana = primero.getDay() - 1
  if (inicioSemana < 0) inicioSemana = 6

  const celdas: (number | null)[] = []
  for (let i = 0; i < inicioSemana; i++) celdas.push(null)
  for (let d = 1; d <= diasTotales; d++) celdas.push(d)

  return celdas
})

const clasesDelMes = computed(() => {
  const lista: any[] = []
  const ultimoDia = new Date(anioActual.value, mesActual.value + 1, 0).getDate()

  materiasVisibles.value.forEach(m => {
    const diaNum = m.dia ? diaSemanaMap[normalizarDia(m.dia)] : undefined
    if (diaNum === undefined) return
    for (let d = 1; d <= ultimoDia; d++) {
      const fechaObj = new Date(anioActual.value, mesActual.value, d)
      if (fechaObj.getDay() !== diaNum) continue
      const fechaStr = `${anioActual.value}-${String(mesActual.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (enPeriodoNoLectivo(fechaStr)) continue
      lista.push({
        id: `clase-${m.codigo}-${fechaStr}`,
        titulo: `Clase: ${m.nombre}`,
        descripcion: `${m.codigo} · ${m.profesor} · ${m.hora}`,
        fecha: fechaStr,
        tipo: 'clase',
        origen: 'clase',
      })
    }
  })
  return lista
})

const todosEventos = computed(() => [...eventos.value, ...clasesDelMes.value])

const eventosDelDia = (dia: number) => {
  const fecha = `${anioActual.value}-${String(mesActual.value + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  return todosEventos.value.filter(e => e.fecha === fecha)
}

const esHoy = (dia: number) => {
  return dia === hoy.getDate() &&
    mesActual.value === hoy.getMonth() &&
    anioActual.value === hoy.getFullYear()
}

const mesAnterior = () => {
  if (mesActual.value === 0) { mesActual.value = 11; anioActual.value-- }
  else mesActual.value--
}
const mesSiguiente = () => {
  if (mesActual.value === 11) { mesActual.value = 0; anioActual.value++ }
  else mesActual.value++
}

const clickDia = (dia: number | null) => {
  if (!dia) return
  diaSeleccionado.value = dia
  eventosDiaSeleccionado.value = eventosDelDia(dia)
  modalCrear.value = false
  formEvento.value = { titulo: '', descripcion: '', tipo: 'general' }
  modalVisible.value = true
}

const fechaSeleccionadaStr = computed(() => {
  if (!diaSeleccionado.value) return ''
  return `${anioActual.value}-${String(mesActual.value + 1).padStart(2, '0')}-${String(diaSeleccionado.value).padStart(2, '0')}`
})

const crearEvento = async () => {
  if (!formEvento.value.titulo.trim()) return
  try {
    const nuevo = {
      titulo: formEvento.value.titulo,
      descripcion: formEvento.value.descripcion,
      tipo: formEvento.value.tipo,
      fecha: fechaSeleccionadaStr.value,
      creadoEn: serverTimestamp()
    }
    const ref = await addDoc(collection(db, 'eventos'), nuevo)
    const eventoLocal = { id: ref.id, ...nuevo, origen: 'manual' }
    eventos.value.push(eventoLocal)
    eventosDiaSeleccionado.value.push(eventoLocal)
    formEvento.value = { titulo: '', descripcion: '', tipo: 'general' }
    modalCrear.value = false
    mostrarToast('Evento creado correctamente')
  } catch (e) {
    console.error(e)
  }
}

const eliminarEvento = async (evento: any) => {
  if (evento.origen !== 'manual') return

  const ok = await dialog.confirm(
    `¿Eliminar el evento "${evento.titulo || 'sin título'}"? Esta acción no se puede deshacer.`,
    {
      title: 'Eliminar evento',
      variant: 'danger',
      confirmText: 'Eliminar',
    },
  )
  if (!ok) return

  try {
    await deleteDoc(doc(db, 'eventos', evento.id))
    eventos.value = eventos.value.filter(e => e.id !== evento.id)
    eventosDiaSeleccionado.value = eventosDiaSeleccionado.value.filter(e => e.id !== evento.id)
    mostrarToast('Evento eliminado')
  } catch (e) {
    console.error(e)
    await dialog.alert('No se pudo eliminar el evento.', { variant: 'error' })
  }
}

const proximosEventos = computed(() => {
  const hoyStr = hoy.toISOString().split('T')[0]
  return todosEventos.value
    .filter(e => e.fecha >= hoyStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 5)
})

const formatFechaCorta = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${parseInt(d)} ${nombresMes[parseInt(m) - 1].slice(0, 3)} ${y}`
}

const colorTipo = (tipo: string) => {
  if (tipo === 'flexibilizacion') return 'tipo-flex'
  if (tipo === 'urgente') return 'tipo-urgente'
  if (tipo === 'clase') return 'tipo-clase'
  if (tipo === 'solicitud-pendiente') return 'tipo-pendiente'
  if (tipo === 'solicitud-aprobada') return 'tipo-aprobada-sol'
  if (tipo === 'solicitud-rechazada') return 'tipo-rechazada-sol'
  return 'tipo-general'
}

const modalPeriodosVisible = ref(false)
const nuevoPeriodo = ref({ inicio: '', fin: '', motivo: '' })
const guardandoPeriodo = ref(false)

const agregarPeriodo = async () => {
  if (!nuevoPeriodo.value.inicio || !nuevoPeriodo.value.fin || !nuevoPeriodo.value.motivo.trim()) return
  guardandoPeriodo.value = true
  try {
    const ref = await addDoc(collection(db, 'periodosNoLectivos'), {
      inicio: nuevoPeriodo.value.inicio,
      fin: nuevoPeriodo.value.fin,
      motivo: nuevoPeriodo.value.motivo.trim(),
      creadoEn: serverTimestamp(),
    })
    periodosNoLectivos.value.push({ id: ref.id, ...nuevoPeriodo.value })
    nuevoPeriodo.value = { inicio: '', fin: '', motivo: '' }
    mostrarToast('Periodo agregado correctamente')
  } catch (e) {
    console.error(e)
  } finally {
    guardandoPeriodo.value = false
  }
}

const eliminarPeriodo = async (id: string) => {
  const periodo = periodosNoLectivos.value.find(p => p.id === id)
  const ok = await dialog.confirm(
    `¿Eliminar el periodo no lectivo "${periodo?.motivo || 'seleccionado'}"? Esta acción no se puede deshacer.`,
    {
      title: 'Eliminar periodo',
      variant: 'danger',
      confirmText: 'Eliminar',
    },
  )
  if (!ok) return

  try {
    await deleteDoc(doc(db, 'periodosNoLectivos', id))
    periodosNoLectivos.value = periodosNoLectivos.value.filter(p => p.id !== id)
    mostrarToast('Periodo eliminado')
  } catch (e) {
    console.error(e)
    await dialog.alert('No se pudo eliminar el periodo.', { variant: 'error' })
  }
}
</script>

<template>
  <div class="calendario-page">

    <div class="cal-layout">

      <!-- ── Calendario principal ── -->
      <div class="cal-main">

        <!-- Navegación mes -->
        <div class="mes-nav">
          <button class="nav-btn" @click="mesAnterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span class="mes-label">{{ nombresMes[mesActual] }} {{ anioActual }}</span>
          <button class="nav-btn" @click="mesSiguiente">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button v-if="esDirector" class="btn btn-secondary btn-periodos" @click="modalPeriodosVisible = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Periodos no lectivos
          </button>
        </div>

        <!-- Días semana -->
        <div class="semana-header">
          <div v-for="dia in diasSemana" :key="dia" class="semana-dia">{{ dia }}</div>
        </div>

        <!-- Grid días -->
        <div v-if="loading" class="cal-loading">
          <div class="spinner"></div>
          <span>Cargando eventos...</span>
        </div>

        <div v-else class="dias-grid">
          <div
            v-for="(dia, idx) in diasDelMes"
            :key="idx"
            :class="['dia-celda', {
              'dia-vacio': !dia,
              'dia-hoy': dia && esHoy(dia),
              'dia-con-eventos': dia && eventosDelDia(dia).length > 0,
              'dia-clickable': !!dia
            }]"
            @click="clickDia(dia)"
          >
            <span v-if="dia" class="dia-numero">{{ dia }}</span>
            <div v-if="dia && eventosDelDia(dia).length > 0" class="eventos-dots">
              <span
                v-for="(ev, i) in eventosDelDia(dia).slice(0, 3)"
                :key="i"
                :class="['dot', colorTipo(ev.tipo)]"
              ></span>
            </div>
          </div>
        </div>

        <!-- Leyenda -->
        <div class="leyenda">
          <div class="leyenda-item">
            <span class="dot tipo-general"></span>
            <span>Evento general</span>
          </div>
          <div class="leyenda-item">
            <span class="dot tipo-flex"></span>
            <span>Flexibilización</span>
          </div>
          <div class="leyenda-item">
            <span class="dot tipo-urgente"></span>
            <span>Urgente</span>
          </div>
          <div class="leyenda-item">
            <span class="dot tipo-clase"></span>
            <span>Clase</span>
          </div>
          <div class="leyenda-item">
            <span class="dot tipo-pendiente"></span>
            <span>Inasistencia pendiente</span>
          </div>
          <div class="leyenda-item">
            <span class="dot tipo-aprobada-sol"></span>
            <span>Inasistencia aprobada</span>
          </div>
        </div>
      </div>

      <!-- ── Panel lateral ── -->
      <div class="cal-sidebar">
        <div class="proximos-header">
          <h3 class="proximos-title">Próximos eventos</h3>
          <span class="proximos-badge">{{ proximosEventos.length }}</span>
        </div>

        <div v-if="proximosEventos.length" class="proximos-list">
          <div
            v-for="ev in proximosEventos"
            :key="ev.id"
            class="proximo-card"
          >
            <div :class="['proximo-color', colorTipo(ev.tipo)]"></div>
            <div class="proximo-info">
              <span class="proximo-titulo">{{ ev.titulo }}</span>
              <span class="proximo-fecha">{{ formatFechaCorta(ev.fecha) }}</span>
              <span v-if="ev.descripcion" class="proximo-desc">{{ ev.descripcion }}</span>
            </div>
          </div>
        </div>

        <p v-else class="proximos-empty">No hay eventos próximos</p>
      </div>
    </div>

    <!-- ── MODAL DÍA ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalVisible" class="modal-overlay" @click.self="modalVisible = false">
          <div class="modal-card">

            <div class="modal-header">
              <div>
                <h2 class="modal-title">{{ formatFechaCorta(fechaSeleccionadaStr) }}</h2>
                <p class="modal-subtitle">{{ eventosDiaSeleccionado.length }} evento(s)</p>
              </div>
              <button class="modal-close" @click="modalVisible = false">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="modal-divider"/>

            <div class="modal-body">
              <!-- Lista de eventos del día -->
              <div v-if="eventosDiaSeleccionado.length" class="eventos-lista">
                <div
                  v-for="ev in eventosDiaSeleccionado"
                  :key="ev.id"
                  class="evento-item"
                >
                  <div :class="['evento-barra', colorTipo(ev.tipo)]"></div>
                  <div class="evento-info">
                    <span class="evento-titulo">{{ ev.titulo }}</span>
                    <span v-if="ev.descripcion" class="evento-desc">{{ ev.descripcion }}</span>
                    <span class="evento-origen">{{ ev.origen === 'auto' ? 'Automático' : ev.origen === 'clase' ? 'Clase recurrente' : 'Manual' }}</span>
                  </div>
                  <button
                    v-if="esDirector && ev.origen === 'manual'"
                    class="evento-delete"
                    @click="eliminarEvento(ev)"
                    title="Eliminar"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                    </svg>
                  </button>
                </div>
              </div>

              <p v-else class="proximos-empty">No hay eventos este día</p>

              <!-- Formulario crear evento (solo director / jefa suprema) -->
              <div v-if="esDirector">
                <button v-if="!modalCrear" class="btn btn-primary btn-full" @click="modalCrear = true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Agregar evento
                </button>

                <div v-else class="crear-form">
                  <div class="field-group">
                    <label class="field-label">Título *</label>
                    <input v-model="formEvento.titulo" class="field-input" placeholder="Nombre del evento"/>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Descripción</label>
                    <input v-model="formEvento.descripcion" class="field-input" placeholder="Detalle opcional"/>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Tipo</label>
                    <div class="select-wrapper">
                      <select v-model="formEvento.tipo" class="field-input field-select">
                        <option value="general">General</option>
                        <option value="urgente">Urgente</option>
                      </select>
                      <svg class="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                  <div class="crear-actions">
                    <button class="btn btn-ghost" @click="modalCrear = false">Cancelar</button>
                    <button class="btn btn-primary" @click="crearEvento">Guardar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── MODAL PERIODOS NO LECTIVOS ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalPeriodosVisible" class="modal-overlay" @click.self="modalPeriodosVisible = false">
          <div class="modal-card">
            <div class="modal-header">
              <div>
                <h2 class="modal-title">Periodos no lectivos</h2>
                <p class="modal-subtitle">Vacaciones, semana santa, etc. — las clases no se generan en estas fechas</p>
              </div>
              <button class="modal-close" @click="modalPeriodosVisible = false">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="modal-divider"/>
            <div class="modal-body">

              <div v-if="periodosNoLectivos.length" class="eventos-lista">
                <div v-for="p in periodosNoLectivos" :key="p.id" class="evento-item">
                  <div class="evento-barra tipo-urgente"></div>
                  <div class="evento-info">
                    <span class="evento-titulo">{{ p.motivo }}</span>
                    <span class="evento-desc">{{ formatFechaCorta(p.inicio) }} — {{ formatFechaCorta(p.fin) }}</span>
                  </div>
                  <button class="evento-delete" @click="eliminarPeriodo(p.id)" title="Eliminar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    </svg>
                  </button>
                </div>
              </div>
              <p v-else class="proximos-empty">No hay periodos registrados</p>

              <div class="crear-form">
                <div class="field-row-periodo">
                  <div class="field-group">
                    <label class="field-label">Desde</label>
                    <input v-model="nuevoPeriodo.inicio" type="date" class="field-input"/>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Hasta</label>
                    <input v-model="nuevoPeriodo.fin" type="date" class="field-input"/>
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label">Motivo</label>
                  <input v-model="nuevoPeriodo.motivo" class="field-input" placeholder="Ej. Vacaciones de mitad de año"/>
                </div>
                <button class="btn btn-primary btn-full" :disabled="guardandoPeriodo" @click="agregarPeriodo">
                  {{ guardandoPeriodo ? 'Guardando...' : 'Agregar periodo' }}
                </button>
              </div>

            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── TOAST ── -->
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
.calendario-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cal-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 4px;
}

.cal-subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── Layout ── */
.cal-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 24px;
  align-items: start;
}

/* ── Calendario principal ── */
.cal-main {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mes-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mes-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.nav-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
}

.nav-btn:hover {
  background: var(--color-background);
  color: var(--color-text);
}

.semana-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.semana-dia {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 0;
}

/* ── Grid días ── */
.dias-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.dia-celda {
  min-height: 72px;
  border-radius: var(--radius);
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: 1px solid transparent;
  transition: all var(--transition);
}

.dia-vacio {
  background: transparent;
}

.dia-clickable {
  cursor: pointer;
  background: var(--color-background);
}

.dia-clickable:hover {
  border-color: var(--color-border);
  background: var(--color-surface);
}

.dia-hoy {
  border-color: var(--color-primary) !important;
  background: var(--color-info-bg) !important;
}

.dia-hoy .dia-numero {
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.dia-numero {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.eventos-dots {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tipo-general { background: var(--color-primary); }
.tipo-flex { background: #10b981; }
.tipo-urgente { background: #ef4444; }
.tipo-clase { background: #8b5cf6; }
.tipo-pendiente { background: #f59e0b; }
.tipo-aprobada-sol { background: #16a34a; }
.tipo-rechazada-sol { background: #dc2626; }

/* ── Leyenda ── */
.leyenda {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-light);
}

.leyenda-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ── Sidebar próximos ── */
.cal-sidebar {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.proximos-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.proximos-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.proximos-badge {
  background: var(--color-primary);
  color: white;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
}

.proximos-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.proximo-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--color-background);
  border-radius: var(--radius);
  border: 1px solid var(--color-border-light);
}

.proximo-color {
  width: 4px;
  border-radius: 99px;
  flex-shrink: 0;
}

.proximo-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.proximo-titulo {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proximo-fecha {
  font-size: 11px;
  color: var(--color-text-muted);
}

.proximo-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proximos-empty {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 12px 0;
}

/* ── Loading ── */
.cal-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
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

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.18);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 24px 20px;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 4px;
}

.modal-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: var(--color-background);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  flex-shrink: 0;
}

.modal-close:hover { background: var(--color-border-light); color: var(--color-text); }
.modal-divider { height: 1px; background: var(--color-border-light); }

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

/* ── Eventos lista ── */
.eventos-lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.evento-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  background: var(--color-background);
  border-radius: var(--radius);
  border: 1px solid var(--color-border-light);
}

.evento-barra {
  width: 4px;
  min-height: 40px;
  border-radius: 99px;
  flex-shrink: 0;
}

.evento-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.evento-titulo {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.evento-desc {
  font-size: 12px;
  color: var(--color-text-muted);
}

.evento-origen {
  font-size: 11px;
  color: var(--color-text-muted);
  font-style: italic;
}

.evento-delete {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: all var(--transition);
  flex-shrink: 0;
}

.evento-delete:hover { background: #fee2e2; color: #dc2626; }

/* ── Crear form ── */
.crear-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: var(--color-background);
  border-radius: var(--radius);
  border: 1px solid var(--color-border-light);
}

.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--color-text); }

.field-input {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  transition: border-color var(--transition);
}

.field-input:focus { border-color: var(--color-primary); }
.select-wrapper { position: relative; }
.field-select { appearance: none; padding-right: 36px; cursor: pointer; }
.select-icon {
  position: absolute; right: 12px; top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted); pointer-events: none;
}

.crear-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* ── Botones ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition);
  border: none;
  cursor: pointer;
}

.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover { background: var(--color-primary-light); }
.btn-ghost {
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn-ghost:hover { background: var(--color-border-light); }
.btn-full { width: 100%; justify-content: center; }

/* ── Toast ── */
.toast-success {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #111827;
  color: white;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}

.toast-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── Transiciones ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .modal-card, .modal-leave-active .modal-card { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card, .modal-leave-to .modal-card { transform: scale(0.95) translateY(8px); opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px) scale(0.95); }

/* ── Responsive ── */
.field-row-periodo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.btn-periodos {
  font-size: 12px;
  padding: 7px 12px;
}

@media (max-width: 768px) {
  .cal-layout { grid-template-columns: 1fr; }
  .dia-celda { min-height: 48px; }
  .field-row-periodo { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .dia-celda { min-height: 40px; font-size: 12px; }
  .btn-periodos { font-size: 11px; padding: 6px 10px; }
}
</style>