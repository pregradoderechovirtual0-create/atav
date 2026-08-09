<script setup lang="ts">
import '@/styles/estudiante-solicitud-page.css'
import { ref, computed, onMounted, watch } from 'vue'
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { obtenerSesion, esperarAuth } from '@/lib/session'
import { notificarDirectores } from '@/lib/notificaciones'
import { confirmarSolicitudEstudiante } from '@/lib/confirmarSolicitudEstudiante'
import { dialog } from '@/lib/dialog'
import { CAUSAS_FLEXIBILIDAD, labelCausaFlexibilidad, formatFechaParcial, formatHoraParcial, esCorreoInstitucionalUsc } from '@/lib/flexibilidadCatalogo'
import {
  fetchMaterias,
  labelMateriaPorCodigo,
  type MateriaRegistrada,
} from '@/lib/materias'
import {
  cargarConfigParciales,
  getRangoParcial,
  getVentanaSeleccion,
  formatRango,
  parcialAbiertoHoy,
  mensajeEstadoParcial,
  type ConfigParciales,
} from '@/lib/parciales'
import MateriaPicker from '@/components/MateriaPicker.vue'
import MateriaInfoPanel from '@/components/MateriaInfoPanel.vue'
import PdfUploadArea from '@/components/PdfUploadArea.vue'
import {
  leerCacheSolicitudes,
  guardarCacheSolicitudes,
  type TipoSolicitudEstudiante,
} from '@/lib/solicitudesEstudianteCache'
import { cargarContactoPerfil } from '@/lib/perfilContacto'

const TIPO_SOLICITUD: TipoSolicitudEstudiante = 'flexibilizaciones'


// ── Estado de pasos ──────────────────────────────────────────────
const currentStep = ref(1)
const totalSteps = 6
const subiendoPdf = ref(false)
const nombreEstudiante = ref('')
const cedulaEstudiante = ref('')

interface SolicitudFlexEstudiante {
  docId: string
  id: string
  nombre: string
  identificacion: string
  parcial: number
  curso: string
  materia: string
  fecha: string
  fechaSolicitud: string
  estado: string
  motivo_rechazo: string
  justa_causa: string
  correo: string
  celular: string
  fecha_parcial: string
  hora_parcial: string
  descripcion: string
  pdf_url: string
}

const solicitudesPendientes = ref<SolicitudFlexEstudiante[]>([])
const modalDetalleVisible = ref(false)
const solicitudDetalle = ref<SolicitudFlexEstudiante | null>(null)

const correoPerfil = ref('')
const celularPerfil = ref('')
const usarCorreoPerfil = ref(false)
const usarCelularPerfil = ref(false)

const abrirDetalle = (sol: SolicitudFlexEstudiante) => {
  solicitudDetalle.value = sol
  modalDetalleVisible.value = true
}

const cerrarDetalle = () => {
  modalDetalleVisible.value = false
  solicitudDetalle.value = null
}

const cargarContactoDesdePerfil = async (cedula: string) => {
  const contacto = await cargarContactoPerfil(cedula)
  correoPerfil.value = contacto.correoInstitucional
  celularPerfil.value = contacto.celular
}

watch(usarCorreoPerfil, (activo) => {
  if (activo && correoPerfil.value) {
    formData.value.correoInstitucional = correoPerfil.value
  } else if (!activo) {
    formData.value.correoInstitucional = ''
  }
})

watch(usarCelularPerfil, (activo) => {
  if (activo && celularPerfil.value) {
    formData.value.celular = celularPerfil.value
  } else if (!activo) {
    formData.value.celular = ''
  }
})


// ── Datos del formulario ─────────────────────────────────────────
const formData = ref({
  parcial: '',
  justaCausa: '',
  justaCausaDetalle: '',
  correoInstitucional: '',
  celular: '',
  curso: '',
  fechaSeleccionada: null as string | null,
  horaSeleccionada: null as string | null,
  archivo: null as File | null,
  descripcion: '',
})

// ── Opciones ─────────────────────────────────────────────────────
const parciales = [
  { id: '1', label: 'Parcial 1' },
  { id: '2', label: 'Parcial 2' },
  { id: '3', label: 'Parcial 3' },
]

const causas = CAUSAS_FLEXIBILIDAD
const materias = ref<MateriaRegistrada[]>([])
const cargandoMaterias = ref(true)

const cursoSeleccionadoLabel = computed(() =>
  labelMateriaPorCodigo(formData.value.curso, materias.value)
)

const materiaSeleccionada = computed(() =>
  materias.value.find(m => m.codigo === formData.value.curso) ?? null,
)

const labelJustaCausaActual = computed(() =>
  labelCausaFlexibilidad(
    formData.value.justaCausa,
    undefined,
    formData.value.justaCausaDetalle,
  ),
)

const justaCausaValida = computed(() => {
  if (!formData.value.justaCausa) return false
  if (formData.value.justaCausa === 'otra') return formData.value.justaCausaDetalle.trim().length > 0
  return true
})

const cargarMaterias = async () => {
  cargandoMaterias.value = true
  try {
    materias.value = await fetchMaterias()
  } finally {
    cargandoMaterias.value = false
  }
}

const configParciales = ref<ConfigParciales>({
  periodo: '',
  notas: '',
  parcial_1: null,
  parcial_2: null,
  parcial_3: null,
})

const ventanaActual = computed(() => {
  if (!formData.value.parcial) return null
  return getVentanaSeleccion(getRangoParcial(configParciales.value, formData.value.parcial))
})

const ventanaTexto = computed(() =>
  ventanaActual.value ? formatRango(ventanaActual.value) : null
)

const parcialesConEstado = computed(() =>
  parciales.map(p => ({
    ...p,
    abierto: parcialAbiertoHoy(configParciales.value, p.id),
    estado: mensajeEstadoParcial(configParciales.value, p.id),
  }))
)

const seleccionarParcial = (id: string, abierto: boolean) => {
  if (!abierto) return
  formData.value.parcial = id
}

// ── Calendario académico (fecha y hora del parcial) ──────────────
// Festivos Colombia 2025-2026 (Ley Emiliani). Ajusta este set cada año.
const FESTIVOS = new Set([
  '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18',
  '2025-05-01', '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20',
  '2025-08-07', '2025-08-18', '2025-10-13', '2025-11-03', '2025-11-17',
  '2025-12-08', '2025-12-25',
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-07-20',
  '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16',
  '2026-12-08', '2026-12-25',
])

const HORARIOS_MANANA = ['08:00', '09:00', '10:00', '11:00']
const HORARIOS_TARDE = ['14:00', '15:00', '16:00', '17:00']

const calMes = ref(new Date().getMonth())
const calAnio = ref(new Date().getFullYear())

const mesesNombres = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const diasSemanaCortos = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const esFestivo = (iso: string) => FESTIVOS.has(iso)
const esFinde = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}
const esDisponible = (iso: string) => {
  if (esFinde(iso) || esFestivo(iso)) return false
  if (!ventanaActual.value) return false
  return iso >= ventanaActual.value.inicio && iso <= ventanaActual.value.fin
}

interface CeldaCalendario {
  dia: number
  iso: string
  disponible: boolean
  festivo: boolean
}

const diasCalendario = computed<(CeldaCalendario | null)[]>(() => {
  const primerDiaSemana = new Date(calAnio.value, calMes.value, 1).getDay()
  const totalDias = new Date(calAnio.value, calMes.value + 1, 0).getDate()
  const celdas: (CeldaCalendario | null)[] = []

  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null)

  for (let d = 1; d <= totalDias; d++) {
    const iso = `${calAnio.value}-${String(calMes.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    celdas.push({ dia: d, iso, disponible: esDisponible(iso), festivo: esFestivo(iso) })
  }
  return celdas
})

const calAnterior = () => {
  if (calMes.value === 0) { calMes.value = 11; calAnio.value-- } else calMes.value--
  formData.value.fechaSeleccionada = null
  formData.value.horaSeleccionada = null
}
const calSiguiente = () => {
  if (calMes.value === 11) { calMes.value = 0; calAnio.value++ } else calMes.value++
  formData.value.fechaSeleccionada = null
  formData.value.horaSeleccionada = null
}

const seleccionarDia = (celda: CeldaCalendario | null) => {
  if (!celda || !celda.disponible) return
  formData.value.fechaSeleccionada = celda.iso
  formData.value.horaSeleccionada = null
}

const formatFechaSolicitud = (ts: any, isoFallback = '') => {
  if (ts?.toDate) {
    return ts.toDate().toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  return isoFallback ? formatFecha(isoFallback) : '—'
}

const formatFecha = (iso: string) => {
  const [y, m, d] = iso.split('-')
  const meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${parseInt(d)} de ${meses[parseInt(m)]} de ${y}`
}

const formatHora = (h: string) => {
  const hh = parseInt(h.split(':')[0])
  return hh < 12 ? `${h} a. m.` : `${hh === 12 ? 12 : hh - 12}:00 p. m.`
}

const datosEstudianteListos = computed(() =>
  nombreEstudiante.value.trim().length > 0 && cedulaEstudiante.value.trim().length > 0,
)

// ── Navegación ────────────────────────────────────────────────────
const canGoNext = computed(() => {
  if (!datosEstudianteListos.value) return false
  if (currentStep.value === 1)
    return formData.value.parcial
      && parcialAbiertoHoy(configParciales.value, formData.value.parcial)
  if (currentStep.value === 2) return !!formData.value.curso && materias.value.length > 0
  if (currentStep.value === 3) return justaCausaValida.value
  if (currentStep.value === 4)
    return esCorreoInstitucionalUsc(formData.value.correoInstitucional) && formData.value.celular
  if (currentStep.value === 5)
    return !!formData.value.fechaSeleccionada && !!formData.value.horaSeleccionada
  if (currentStep.value === 6) return !!formData.value.archivo && !!formData.value.descripcion
  return true
})

const formularioCompleto = computed(() =>
  datosEstudianteListos.value
    && !!formData.value.parcial
    && parcialAbiertoHoy(configParciales.value, formData.value.parcial)
    && justaCausaValida.value
    && esCorreoInstitucionalUsc(formData.value.correoInstitucional)
    && !!formData.value.celular
    && !!formData.value.curso
    && materias.value.length > 0
    && !!formData.value.fechaSeleccionada
    && !!formData.value.horaSeleccionada
    && !!formData.value.archivo
    && !!formData.value.descripcion,
)

const nextStep = () => { if (currentStep.value < totalSteps && canGoNext.value) currentStep.value++ }
const prevStep = () => { if (currentStep.value > 1) currentStep.value-- }

// ── Upload ────────────────────────────────────────────────────────
const archivoNombre = ref('')
const toastVisible = ref(false)
const toastMensaje = ref('')
const toastTipo = ref<'success' | 'error'>('success')
let toastTimeout: ReturnType<typeof setTimeout>

const mostrarToast = (mensaje: string, tipo: 'success' | 'error' = 'success') => {
  toastMensaje.value = mensaje
  toastTipo.value = tipo
  toastVisible.value = true
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toastVisible.value = false }, 3500)
}

const onPdfSelect = (file: File) => {
  formData.value.archivo = file
  archivoNombre.value = file.name
}

const onPdfError = (mensaje: string) => {
  mostrarToast(mensaje, 'error')
}
// ── Submit ────────────────────────────────────────────────────────
const enviar = async () => {
  const user = auth.currentUser
  if (!user || !formularioCompleto.value) return

  subiendoPdf.value = true

  try {
    let pdfUrl = ''
    if (formData.value.archivo) {
      const formDataCloud = new FormData()
      formDataCloud.append('file', formData.value.archivo as File)
      formDataCloud.append('upload_preset', 'flexibilizaciones_pdf')

      const res = await fetch(
        'https://api.cloudinary.com/v1_1/dhbehhvb5/image/upload',
        { method: 'POST', body: formDataCloud }
      )
      const data = await res.json()

      if (!data.secure_url) {
        mostrarToast('Error al subir el PDF', 'error')
        subiendoPdf.value = false
        return
      }
      pdfUrl = data.secure_url
    }

    await addDoc(collection(db, 'flexibilizaciones'), {
      estudiante_id: user.uid,
      estudiante_correo: user.email,
      nombre: nombreEstudiante.value,
      identificacion: cedulaEstudiante.value,
      parcial: formData.value.parcial,
      justa_causa: formData.value.justaCausa,
      justa_causa_label: labelJustaCausaActual.value,
      correo: formData.value.correoInstitucional,
      celular: formData.value.celular,
      curso: formData.value.curso,
      curso_label: cursoSeleccionadoLabel.value,
      fecha_parcial: formData.value.fechaSeleccionada,
      hora_parcial: formData.value.horaSeleccionada,
      descripcion: formData.value.descripcion,
      pdf_url: pdfUrl,
      estado: 'pendiente',
      fecha_creacion: serverTimestamp()
    })

    await notificarDirectores({
      titulo: 'Nueva solicitud de flexibilización',
      mensaje: `${nombreEstudiante.value} solicitó flexibilización para ${cursoSeleccionadoLabel.value} (Parcial ${formData.value.parcial}).`,
      tipo: 'info',
      ruta: '/director/solicitudes',
    })

    await cargarSolicitudes(user.uid)
    currentStep.value = 1
    formData.value = {
      parcial: '',
      justaCausa: '', justaCausaDetalle: '', correoInstitucional: '', celular: '',
      curso: '', fechaSeleccionada: null,
      horaSeleccionada: null,
      archivo: null, descripcion: ''
    }
    archivoNombre.value = ''
    mostrarToast('Solicitud enviada correctamente')
  } catch (error) {
    console.error('Error al enviar:', error)
    mostrarToast('Hubo un error al enviar la solicitud', 'error')
  } finally {
    subiendoPdf.value = false  // 👈 desactiva siempre al final
  }
}

const solicitarEnvio = async () => {
  if (!formularioCompleto.value) {
    if (!datosEstudianteListos.value) {
      await dialog.alert('No encontramos tu nombre o cédula en el sistema. Contacta a la institución.', { variant: 'error' })
    }
    return
  }

  const fechaTxt = formData.value.fechaSeleccionada
    ? formatFecha(formData.value.fechaSeleccionada)
    : '—'
  const horaTxt = formData.value.horaSeleccionada
    ? formatHora(formData.value.horaSeleccionada)
    : '—'

  const ok = await confirmarSolicitudEstudiante(
    { nombre: nombreEstudiante.value, cedula: cedulaEstudiante.value },
    {
      tipo: 'flexibilización',
      detalles: [
        { label: 'Materia', value: cursoSeleccionadoLabel.value },
        { label: 'Parcial', value: `Parcial ${formData.value.parcial}` },
        { label: 'Justa causa', value: labelJustaCausaActual.value },
        { label: 'Fecha solicitada', value: fechaTxt },
        { label: 'Hora solicitada', value: horaTxt },
        { label: 'Correo', value: formData.value.correoInstitucional },
        { label: 'Celular', value: formData.value.celular },
      ],
    },
    { titulo: 'Confirmar flexibilización' },
  )
  if (ok) await enviar()
}

const cargarSolicitudes = async (uid: string) => {
  const q = query(collection(db, 'flexibilizaciones'), where('estudiante_id', '==', uid))
  const snap = await getDocs(q)
  solicitudesPendientes.value = snap.docs.map(docSnap => {
    const d = docSnap.data()
    const materia = d.curso_label
      || labelMateriaPorCodigo(d.curso, materias.value, d.curso)
    return {
      docId: docSnap.id,
      id: docSnap.id.slice(0, 8).toUpperCase(),
      nombre: d.nombre || '',
      identificacion: d.identificacion || '',
      parcial: parseInt(d.parcial),
      curso: d.curso || '',
      materia,
      fecha: d.fecha_creacion?.toDate().toISOString().split('T')[0] || '',
      fechaSolicitud: formatFechaSolicitud(d.fecha_creacion),
      estado: d.estado === 'pendiente' ? 'Pendiente'
        : d.estado === 'aprobada' ? 'Aprobada' : 'Rechazada',
      motivo_rechazo: d.motivo_rechazo || '',
      justa_causa: d.justa_causa_label || labelCausaFlexibilidad(d.justa_causa),
      correo: d.correo || '',
      celular: d.celular || '',
      fecha_parcial: d.fecha_parcial || '',
      hora_parcial: d.hora_parcial || '',
      descripcion: d.descripcion || '',
      pdf_url: d.pdf_url || '',
    }
  }).sort((a, b) => b.fecha.localeCompare(a.fecha))
  guardarCacheSolicitudes(uid, TIPO_SOLICITUD, solicitudesPendientes.value)
}

const iniciarSolicitudesEstudiante = async (uid: string) => {
  const cached = leerCacheSolicitudes<SolicitudFlexEstudiante>(uid, TIPO_SOLICITUD)
  if (cached) solicitudesPendientes.value = cached
  await cargarSolicitudes(uid)
}

onMounted(async () => {
  await esperarAuth()
  const uid = auth.currentUser?.uid
  if (uid) iniciarSolicitudesEstudiante(uid)

  onAuthStateChanged(auth, (user: any) => {
    if (user) iniciarSolicitudesEstudiante(user.uid)
  })

  const sesion = await obtenerSesion()
  if (sesion?.nombre?.trim()) nombreEstudiante.value = sesion.nombre.trim()
  if (sesion?.cedula) {
    cedulaEstudiante.value = sesion.cedula
    await cargarContactoDesdePerfil(sesion.cedula)
  }

  cargarConfigParciales().then(c => { configParciales.value = c })
  cargarMaterias()
})

watch(() => formData.value.justaCausa, (causa) => {
  if (causa !== 'otra') formData.value.justaCausaDetalle = ''
})

watch(() => configParciales.value, () => {
  if (formData.value.parcial && !parcialAbiertoHoy(configParciales.value, formData.value.parcial)) {
    formData.value.parcial = ''
  }
}, { deep: true })

watch(() => formData.value.parcial, (parcial) => {
  formData.value.fechaSeleccionada = null
  formData.value.horaSeleccionada = null
  if (!parcial) return
  const ventana = getVentanaSeleccion(getRangoParcial(configParciales.value, parcial))
  if (ventana?.inicio) {
    const d = new Date(ventana.inicio + 'T12:00:00')
    calMes.value = d.getMonth()
    calAnio.value = d.getFullYear()
  }
})

// ── Labels de pasos ──────────────────────────────────────────────
const stepMeta = [
  { label: 'Parcial', hint: 'Selecciona el parcial a flexibilizar' },
  { label: 'Curso', hint: 'Materia a flexibilizar' },
  { label: 'Causa', hint: 'Motivo de la solicitud' },
  { label: 'Contacto', hint: 'Correo y celular' },
  { label: 'Fecha', hint: 'Día y hora del parcial' },
  { label: 'Soporte', hint: 'PDF y descripción' },
]

const pasoActualHint = computed(() => stepMeta[currentStep.value - 1]?.hint ?? '')
const progresoPct = computed(() => Math.round((currentStep.value / totalSteps) * 100))

const irAPaso = (paso: number) => {
  if (paso < currentStep.value) currentStep.value = paso
}
</script>

<template>
  <div class="sol-page sol-page--flex">
    <div class="sol-layout">
      <aside class="sol-sidebar">
        <section class="sol-pendientes">
          <div class="sol-pendientes-header">
            <h2 class="sol-pendientes-title">Mis flexibilizaciones</h2>
            <span class="sol-pendientes-badge">{{ solicitudesPendientes.length }}</span>
          </div>

          <div v-if="solicitudesPendientes.length" class="sol-pendientes-list">
            <div v-for="sol in solicitudesPendientes" :key="sol.docId" class="sol-pendiente-card">
              <div class="sol-pendiente-row">
                <div class="sol-pendiente-left">
                  <span class="sol-pendiente-id">#{{ sol.id }}</span>
                  <span class="sol-pendiente-curso">{{ sol.materia }}</span>
                  <span class="sol-pendiente-meta">Parcial {{ sol.parcial }} · {{ sol.fechaSolicitud }}</span>
                </div>
                <div class="sol-pendiente-actions">
                  <span :class="['sol-estado-chip',
                    sol.estado === 'Pendiente' ? 'sol-estado-pendiente' :
                    sol.estado === 'Aprobada' ? 'sol-estado-aprobada' : 'sol-estado-rechazada'
                  ]">{{ sol.estado }}</span>
                  <button type="button" class="sol-btn-detalle" @click="abrirDetalle(sol)">Ver detalle</button>
                </div>
              </div>
              <div v-if="sol.motivo_rechazo && sol.estado === 'Rechazada'" class="sol-motivo-rechazo">
                <span class="sol-motivo-rechazo-label">Motivo de rechazo</span>
                <p class="sol-motivo-rechazo-text">{{ sol.motivo_rechazo }}</p>
              </div>
            </div>
          </div>

          <p v-else class="sol-pendientes-empty">No tienes solicitudes pendientes.</p>
        </section>
      </aside>

      <main class="sol-main">
        <section class="sol-form-card">
          <header class="sol-form-header">
            <div class="sol-form-intro">
              <div class="sol-form-intro-text">
                <p class="sol-form-kicker">Nueva solicitud</p>
                <h2 class="sol-form-step-title">{{ pasoActualHint }}</h2>
              </div>
              <span class="sol-form-step-count">{{ currentStep }}/{{ totalSteps }}</span>
            </div>

            <div class="sol-form-progress">
              <div class="sol-form-progress-fill" :style="{ width: `${progresoPct}%` }"/>
            </div>

            <div class="sol-stepper" role="tablist" aria-label="Pasos del formulario">
              <template v-for="(meta, idx) in stepMeta" :key="meta.label">
                <button
                  type="button"
                  role="tab"
                  :aria-selected="currentStep === idx + 1"
                  :class="['sol-stepper-step', {
                    active: currentStep === idx + 1,
                    done: currentStep > idx + 1,
                  }]"
                  :disabled="idx + 1 > currentStep"
                  @click="irAPaso(idx + 1)"
                >
                  <span class="sol-stepper-dot">
                    <svg v-if="currentStep > idx + 1" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span v-else>{{ idx + 1 }}</span>
                  </span>
                  <span class="sol-stepper-label">{{ meta.label }}</span>
                </button>
              </template>
            </div>
          </header>

          <div class="sol-form-body">
      <!-- Paso 1: Parcial -->
      <div v-if="currentStep === 1" class="sol-step-content">
        <div class="sol-step-header">
          <h2>Parcial a flexibilizar</h2>
          <p>Selecciona el parcial que necesitas cambiar de fecha u hora</p>
        </div>
        <div class="sol-form-grid">
          <div class="sol-form-group full-width">
            <label class="sol-form-label">Parcial</label>
            <p v-if="configParciales.periodo" class="sol-periodo-hint">Periodo académico {{ configParciales.periodo }}</p>
            <div class="sol-parcial-cards">
              <button
                v-for="p in parcialesConEstado"
                :key="p.id"
                type="button"
                :class="['sol-parcial-card', {
                  selected: formData.parcial === p.id,
                  disabled: !p.abierto,
                  abierto: p.abierto,
                }]"
                :disabled="!p.abierto"
                @click="seleccionarParcial(p.id, p.abierto)"
              >
                <span class="sol-parcial-card-title">{{ p.label }}</span>
                <span class="sol-parcial-card-status">{{ p.estado }}</span>
                <span v-if="formData.parcial === p.id" class="sol-parcial-card-check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Paso 2: Curso -->
      <div v-if="currentStep === 2" class="sol-step-content">
        <div class="sol-step-header">
          <h2>Selección de curso</h2>
          <p>Busca y selecciona la materia correspondiente al parcial</p>
        </div>
        <p v-if="cargandoMaterias" class="sol-pendientes-empty">Cargando materias...</p>
        <template v-else>
          <MateriaPicker v-model="formData.curso" :materias="materias" />
          <MateriaInfoPanel v-if="materiaSeleccionada" :materia="materiaSeleccionada" />
        </template>
      </div>

      <!-- Paso 3: Justa causa -->
      <div v-if="currentStep === 3" class="sol-step-content">
        <div class="sol-step-header">
          <h2>Justa causa de la solicitud</h2>
          <p>Selecciona el motivo que justifica la flexibilización</p>
        </div>
        <div class="sol-opciones-grid">
          <button
            v-for="causa in causas"
            :key="causa.id"
            type="button"
            :class="['sol-opcion-card', { selected: formData.justaCausa === causa.id }]"
            @click="formData.justaCausa = causa.id"
          >
            <div class="sol-opcion-radio">
              <div class="sol-opcion-radio-inner"></div>
            </div>
            <div class="tipo-content">
              <span class="sol-opcion-label">{{ causa.label }}</span>
            </div>
          </button>
        </div>
        <div v-if="formData.justaCausa === 'otra'" class="sol-form-group" style="margin-top: 16px">
          <label class="sol-form-label"><span class="sol-required">*</span> Describe la justa causa</label>
          <textarea
            v-model="formData.justaCausaDetalle"
            class="sol-form-textarea"
            rows="3"
            placeholder="Escribe el motivo de tu solicitud..."
          />
        </div>
      </div>

      <!-- Paso 4: Contacto -->
      <div v-if="currentStep === 4" class="sol-step-content">
        <div class="sol-step-header">
          <h2>Datos de contacto</h2>
          <p>Ingresa tu correo institucional y número de celular</p>
        </div>
        <div class="sol-form-grid">
          <div v-if="correoPerfil" class="sol-form-group full-width">
            <label class="sol-perfil-pref">
              <input v-model="usarCorreoPerfil" type="checkbox" class="sol-perfil-pref-check" />
              <span class="sol-perfil-pref-text">
                Usar mi correo guardado: <strong>{{ correoPerfil }}</strong>
              </span>
            </label>
          </div>
          <div class="sol-form-group full-width">
            <label class="sol-form-label">Correo institucional</label>
            <input
              v-model="formData.correoInstitucional"
              type="email"
              class="sol-form-input"
              placeholder="usuario@usc.edu.co"
              :readonly="usarCorreoPerfil"
            />
            <p v-if="formData.correoInstitucional && !esCorreoInstitucionalUsc(formData.correoInstitucional)" class="sol-form-hint" style="color: #dc2626">
              El correo debe terminar en @usc.edu.co
            </p>
          </div>
          <div v-if="celularPerfil" class="sol-form-group full-width">
            <label class="sol-perfil-pref">
              <input v-model="usarCelularPerfil" type="checkbox" class="sol-perfil-pref-check" />
              <span class="sol-perfil-pref-text">
                Usar mi celular guardado: <strong>{{ celularPerfil }}</strong>
              </span>
            </label>
          </div>
          <div class="sol-form-group full-width">
            <label class="sol-form-label">Número de celular</label>
            <input
              v-model="formData.celular"
              type="tel"
              class="sol-form-input"
              placeholder="Ej. 3001234567"
              :readonly="usarCelularPerfil"
            />
          </div>
        </div>
      </div>

      <!-- Paso 5: Calendario de fecha y hora -->
      <div v-if="currentStep === 5" class="sol-step-content">
        <div class="sol-step-header">
          <h2>Fecha y hora del parcial</h2>
          <p>Selecciona un día hábil y el horario disponible</p>
        </div>

        <div v-if="ventanaTexto" class="ventana-info">
          <span v-if="configParciales.periodo" class="periodo-badge">{{ configParciales.periodo }}</span>
          Parcial {{ formData.parcial }}: puedes elegir del <strong>{{ ventanaTexto }}</strong> (días hábiles)
          <span v-if="configParciales.notas" class="periodo-notas">{{ configParciales.notas }}</span>
        </div>
        <div v-else class="ventana-info ventana-warning">
          Las fechas del Parcial {{ formData.parcial }} aún no están configuradas.
        </div>

        <div class="cal-wrapper">
          <div class="cal-nav">
            <button class="cal-nav-btn" type="button" @click="calAnterior">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="cal-mes-label">{{ mesesNombres[calMes] }} {{ calAnio }}</span>
            <button class="cal-nav-btn" type="button" @click="calSiguiente">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div class="cal-grid">
            <div v-for="ds in diasSemanaCortos" :key="ds" class="cal-head">{{ ds }}</div>
            <div
              v-for="(celda, i) in diasCalendario"
              :key="i"
              :class="['cal-celda', {
                vacia: !celda,
                disponible: celda && celda.disponible,
                nodisponible: celda && !celda.disponible && !celda.festivo,
                festivo: celda && celda.festivo,
                seleccionado: celda && formData.fechaSeleccionada === celda.iso
              }]"
              @click="seleccionarDia(celda)"
            >
              <span v-if="celda" class="cal-num">{{ celda.dia }}</span>
            </div>
          </div>

          <div class="cal-leyenda">
            <span class="ley-item"><span class="ley-dot disponible"></span> Disponible</span>
            <span class="ley-item"><span class="ley-dot nodisponible"></span> No disponible</span>
            <span class="ley-item"><span class="ley-dot festivo-c"></span> Festivo</span>
          </div>
        </div>

        <div v-if="formData.fechaSeleccionada" class="horarios-wrap">
          <p class="horarios-titulo">
            Horarios disponibles — <strong>{{ formatFecha(formData.fechaSeleccionada) }}</strong>
          </p>

          <div class="horarios-grupo">
            <p class="horarios-jornada">Mañana</p>
            <div class="horarios-grid">
              <button
                v-for="h in HORARIOS_MANANA" :key="h" type="button"
                :class="['hora-btn', { selected: formData.horaSeleccionada === h }]"
                @click="formData.horaSeleccionada = h"
              >
                {{ formatHora(h) }}
              </button>
            </div>
          </div>

          <div class="horarios-grupo">
            <p class="horarios-jornada">Tarde</p>
            <div class="horarios-grid">
              <button
                v-for="h in HORARIOS_TARDE" :key="h" type="button"
                :class="['hora-btn', { selected: formData.horaSeleccionada === h }]"
                @click="formData.horaSeleccionada = h"
              >
                {{ formatHora(h) }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="formData.fechaSeleccionada && formData.horaSeleccionada" class="fecha-seleccionada-info">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Seleccionaste: <strong>{{ formatFecha(formData.fechaSeleccionada) }}</strong> a las <strong>{{ formatHora(formData.horaSeleccionada) }}</strong>
        </div>
      </div>

      <!-- Paso 6: Soporte y descripción -->
      <div v-if="currentStep === 6" class="sol-step-content">
        <div class="sol-step-header">
          <h2>Soporte y descripción</h2>
          <p>Adjunta la evidencia en PDF y describe brevemente tu solicitud</p>
        </div>
        <div class="sol-form-grid">
          <div class="sol-form-group full-width">
            <label class="sol-form-label">Evidencia de soporte <span class="sol-label-hint">(solo PDF)</span></label>
            <PdfUploadArea
              :file-name="archivoNombre"
              @select="onPdfSelect"
              @error="onPdfError"
            />
          </div>
          <div class="sol-form-group full-width">
            <label class="sol-form-label">Descripción de la solicitud</label>
            <textarea
              v-model="formData.descripcion"
              class="sol-form-textarea"
              rows="4"
              placeholder="Describe brevemente el motivo de tu solicitud de flexibilización..."
            ></textarea>
          </div>
        </div>
      </div>

          </div>

          <footer class="sol-form-footer">
            <button v-if="currentStep > 1" type="button" class="sol-btn sol-btn-secondary" @click="prevStep">
              Anterior
            </button>
            <div v-else class="sol-form-footer-spacer"/>

            <div class="sol-form-footer-actions">
              <router-link to="/estudiante" class="sol-btn sol-btn-ghost">Cancelar</router-link>
              <button
                v-if="currentStep < totalSteps"
                type="button"
                class="sol-btn sol-btn-primary"
                :disabled="!canGoNext"
                @click="nextStep"
              >
                Continuar
              </button>
              <button
                v-else
                type="button"
                class="sol-btn sol-btn-primary"
                :disabled="!canGoNext || subiendoPdf"
                @click="solicitarEnvio"
              >
                <span v-if="subiendoPdf" class="sol-btn-spinner"/>
                {{ subiendoPdf ? 'Enviando...' : 'Enviar solicitud' }}
              </button>
            </div>
          </footer>
        </section>
      </main>
    </div>

    <!-- Modal detalle solicitud -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalDetalleVisible && solicitudDetalle" class="modal-overlay" @click.self="cerrarDetalle">
          <div class="modal-detalle-card">
            <div class="modal-detalle-header">
              <div>
                <h2 class="modal-detalle-title">Detalle de flexibilización</h2>
                <p class="modal-detalle-sub">#{{ solicitudDetalle.id }}</p>
              </div>
              <button type="button" class="modal-detalle-close" @click="cerrarDetalle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="modal-detalle-body">
              <div class="detalle-estado-row">
                <span :class="['sol-estado-chip',
                  solicitudDetalle.estado === 'Pendiente' ? 'sol-estado-pendiente' :
                  solicitudDetalle.estado === 'Aprobada' ? 'sol-estado-aprobada' : 'sol-estado-rechazada'
                ]">{{ solicitudDetalle.estado }}</span>
                <span class="detalle-fecha-sol">Solicitada el {{ solicitudDetalle.fechaSolicitud }}</span>
              </div>

              <div class="detalle-block">
                <h3 class="detalle-block-title">Materia y parcial</h3>
                <div class="detalle-grid">
                  <div class="detalle-item">
                    <span class="detalle-label">Materia</span>
                    <span class="detalle-value">{{ solicitudDetalle.materia }}</span>
                  </div>
                  <div class="detalle-item">
                    <span class="detalle-label">Parcial</span>
                    <span class="detalle-value">Parcial {{ solicitudDetalle.parcial }}</span>
                  </div>
                </div>
              </div>

              <div class="detalle-block">
                <h3 class="detalle-block-title">Fecha y hora solicitadas</h3>
                <div class="detalle-grid">
                  <div class="detalle-item">
                    <span class="detalle-label">Fecha del parcial</span>
                    <span class="detalle-value">{{ formatFechaParcial(solicitudDetalle.fecha_parcial) }}</span>
                  </div>
                  <div class="detalle-item">
                    <span class="detalle-label">Hora</span>
                    <span class="detalle-value">{{ formatHoraParcial(solicitudDetalle.hora_parcial) }}</span>
                  </div>
                </div>
              </div>

              <div class="detalle-block">
                <h3 class="detalle-block-title">Justa causa</h3>
                <p class="detalle-texto">{{ solicitudDetalle.justa_causa || '—' }}</p>
              </div>

              <div class="detalle-block">
                <h3 class="detalle-block-title">Contacto</h3>
                <div class="detalle-grid">
                  <div class="detalle-item">
                    <span class="detalle-label">Correo institucional</span>
                    <span class="detalle-value">{{ solicitudDetalle.correo || '—' }}</span>
                  </div>
                  <div class="detalle-item">
                    <span class="detalle-label">Celular</span>
                    <span class="detalle-value">{{ solicitudDetalle.celular || '—' }}</span>
                  </div>
                </div>
              </div>

              <div v-if="solicitudDetalle.descripcion" class="detalle-block">
                <h3 class="detalle-block-title">Descripción</h3>
                <p class="detalle-texto">{{ solicitudDetalle.descripcion }}</p>
              </div>

              <div v-if="solicitudDetalle.pdf_url" class="detalle-block">
                <h3 class="detalle-block-title">Soporte PDF</h3>
                <a :href="solicitudDetalle.pdf_url" target="_blank" class="detalle-pdf-link">
                  Ver documento adjunto
                </a>
              </div>

              <div v-if="solicitudDetalle.motivo_rechazo && solicitudDetalle.estado === 'Rechazada'" class="detalle-rechazo">
                <h3 class="detalle-block-title">Motivo de rechazo</h3>
                <p class="detalle-rechazo-texto">{{ solicitudDetalle.motivo_rechazo }}</p>
              </div>
            </div>
            <div class="modal-detalle-footer">
              <button type="button" class="sol-btn sol-btn-secondary" @click="cerrarDetalle">Cerrar</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
  <Transition name="toast">
    <div v-if="toastVisible" :class="['toast', toastTipo === 'error' ? 'toast-error' : 'toast-success']">
      <div class="toast-icon">
        <svg v-if="toastTipo === 'success'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
      <span>{{ toastMensaje }}</span>
    </div>
  </Transition>
</Teleport>
<!-- Overlay de carga -->
<Teleport to="body">
  <div v-if="subiendoPdf" class="loading-overlay">
    <div class="loading-box">
      <div class="loading-spinner"></div>
      <p class="loading-text">Subiendo solicitud...</p>
      <span class="loading-hint">Por favor espera, no cierres la página</span>
    </div>
  </div>
</Teleport>
  </div>
</template>

<style scoped>
.tipo-codigo {
  font-family: monospace;
  font-size: 12px;
  font-weight: 700;
  color: #10b981;
}

.search-box {
  position: relative;
  margin-bottom: 12px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  padding-left: 38px !important;
}

.ventana-info {
  font-size: 13px;
  color: var(--color-accent);
  background: var(--color-info-bg);
  padding: 10px 14px;
  border-radius: var(--radius);
  margin-bottom: 16px;
  line-height: 1.5;
}

.ventana-warning {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.periodo-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  background: #10b981;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 8px;
}

.periodo-notas {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
}

.cal-wrapper {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 20px;
}

.cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.cal-mes-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.cal-nav-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
  color: var(--color-text-secondary);
}

.cal-nav-btn:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-head {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 4px 0;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.cal-celda {
  aspect-ratio: 1;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all var(--transition);
}

.cal-celda.disponible {
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.cal-celda.disponible:hover {
  border-color: #10b981;
  background: #ecfdf5;
}

.cal-celda.seleccionado {
  background: #10b981 !important;
  border-color: #10b981 !important;
}

.cal-celda.seleccionado .cal-num {
  color: white;
  font-weight: 700;
}

.cal-celda.nodisponible {
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.cal-celda.festivo {
  background: var(--color-border-light);
  border: 1px dashed var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.cal-num {
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.cal-leyenda {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);
  flex-wrap: wrap;
}

.ley-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.ley-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.ley-dot.disponible {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.ley-dot.nodisponible {
  background: var(--color-border-light);
}

.ley-dot.festivo-c {
  background: var(--color-border-light);
  border: 1px dashed var(--color-border);
}

.horarios-wrap {
  margin-top: 8px;
}

.horarios-titulo {
  font-size: 14px;
  color: var(--color-text);
  margin: 0 0 12px;
}

.horarios-grupo {
  margin-bottom: 14px;
}

.horarios-jornada {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.horarios-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.hora-btn {
  padding: 10px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition);
}

.hora-btn:hover {
  border-color: #10b981;
  background: #ecfdf5;
}

.hora-btn.selected {
  background: #10b981;
  border-color: #10b981;
  color: white;
}

.fecha-seleccionada-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 12px 14px;
  background: #ecfdf5;
  border: 1px solid #86efac;
  border-radius: var(--radius);
  margin-top: 12px;
}

.toast {
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-success .toast-icon { background: #10b981; }
.toast-error .toast-icon { background: #ef4444; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px) scale(0.95); }

.modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}

.modal-detalle-card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.18);
  width: 100%; max-width: 560px;
  max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;
}

.modal-detalle-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 22px 24px 18px; border-bottom: 1px solid var(--color-border-light);
}

.modal-detalle-title { font-size: 17px; font-weight: 700; margin: 0 0 4px; color: var(--color-text); }
.modal-detalle-sub { font-size: 12px; color: var(--color-text-muted); margin: 0; }

.modal-detalle-close {
  width: 32px; height: 32px; border-radius: 8px; border: none; cursor: pointer;
  background: var(--color-background); color: var(--color-text-muted);
  display: flex; align-items: center; justify-content: center;
}

.modal-detalle-body { padding: 16px 24px 20px; overflow-y: auto; }

.modal-detalle-footer {
  padding: 14px 24px 20px; border-top: 1px solid var(--color-border-light);
  display: flex; justify-content: flex-end;
}

.detalle-estado-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 16px; padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.detalle-fecha-sol { font-size: 12px; color: var(--color-text-muted); }
.detalle-block { padding: 14px 0; border-top: 1px solid var(--color-border-light); }
.detalle-block:first-of-type { border-top: none; padding-top: 0; }
.detalle-block-title {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.4px; color: var(--color-text-muted); margin: 0 0 10px;
}
.detalle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.detalle-item { display: flex; flex-direction: column; gap: 4px; }
.detalle-label { font-size: 11px; font-weight: 600; color: var(--color-text-muted); }
.detalle-value { font-size: 13px; color: var(--color-text); font-weight: 500; line-height: 1.4; }
.detalle-texto { margin: 0; font-size: 13px; line-height: 1.6; color: var(--color-text); }
.detalle-pdf-link {
  font-size: 13px; font-weight: 500; color: var(--color-accent);
  text-decoration: none; padding: 8px 12px; background: var(--color-info-bg);
  border-radius: 8px; display: inline-block;
}
.detalle-rechazo {
  margin-top: 4px; padding: 12px; background: #fef2f2;
  border: 1px solid #fecaca; border-radius: 10px;
}
.detalle-rechazo-texto { margin: 0; font-size: 13px; color: #dc2626; line-height: 1.55; }
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-box {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 36px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.2);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.loading-hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .horarios-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detalle-grid {
    grid-template-columns: 1fr;
  }
}
</style>