<script setup lang="ts">
import '@/estilos/estudiante-solicitud-page.css'
import { ref, computed, onMounted, watch } from 'vue'
import {
  collection, addDoc, query, where,
  getDocs, serverTimestamp
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { obtenerSesion, esperarAuth } from '@/lib/autenticacion/session'
import { notificarDirectores } from '@/lib/dominio/notificaciones'
import { fetchMaterias, labelMateriaPorCodigo, type MateriaRegistrada } from '@/lib/dominio/materias'
import { dialog } from '@/lib/nucleo/dialog'
import { confirmarSolicitudEstudiante } from '@/lib/solicitudes/confirmarSolicitudEstudiante'
import MateriaPicker from '@/componentes/controles/MateriaPicker.vue'
import MateriaInfoPanel from '@/componentes/controles/MateriaInfoPanel.vue'
import PdfUploadArea from '@/componentes/controles/PdfUploadArea.vue'
import {
  leerCacheSolicitudes,
  guardarCacheSolicitudes,
  type TipoSolicitudEstudiante,
} from '@/lib/solicitudes/solicitudesEstudianteCache'

const TIPO_SOLICITUD: TipoSolicitudEstudiante = 'supletorios'

const emit = defineEmits(['crear'])

const solicitudesPendientes = ref<any[]>([])
const nombreEstudiante = ref('')
const cedulaEstudiante = ref('')

const formatFecha = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(d)} ${meses[parseInt(m)]} ${y}`
}

const cargarSolicitudes = async (uid: string) => {
  const q = query(collection(db, 'supletorios'), where('estudiante_id', '==', uid))
  const snap = await getDocs(q)
  solicitudesPendientes.value = snap.docs.map(doc => {
    const d = doc.data()
    return {
      id: doc.id.slice(0, 8).toUpperCase(),
      curso: d.nombre_curso || d.curso || '—',
      fecha: d.fecha_creacion?.toDate().toISOString().split('T')[0] || '',
      estado: d.estado === 'pendiente' ? 'Pendiente'
        : d.estado === 'aprobada' ? 'Aprobada' : 'Rechazada',
      motivo_rechazo: d.motivo_rechazo || '',
    }
  })
  guardarCacheSolicitudes(uid, TIPO_SOLICITUD, solicitudesPendientes.value)
}

const materias = ref<MateriaRegistrada[]>([])

const cargarMaterias = async () => {
  materias.value = await fetchMaterias()
}

const formData = ref({
  semestre: '',
  docente: '',
  nombreCurso: '',
  unidades: '',
  actividades: '',
})

watch(() => formData.value.nombreCurso, (codigo) => {
  const materia = materias.value.find(m => m.codigo === codigo)
  if (materia) {
    formData.value.docente = materia.profesor || ''
    formData.value.semestre = materia.semestre || ''
  } else {
    formData.value.docente = ''
    formData.value.semestre = ''
  }
})

const materiaSeleccionada = computed(() =>
  materias.value.find(m => m.codigo === formData.value.nombreCurso) ?? null,
)

const archivo = ref<File | null>(null)
const archivoNombre = ref('')

const onPdfSelect = (file: File) => {
  archivo.value = file
  archivoNombre.value = file.name
}

const onPdfError = (mensaje: string) => {
  dialog.alert(mensaje, { variant: 'error' })
}

const currentStep = ref(1)
const totalSteps = 2

const stepMeta = [
  { label: 'Curso', hint: 'Selecciona la materia' },
  { label: 'Actividades', hint: 'Unidades, actividades y PDF firmado' },
]

const pasoActualHint = computed(() => stepMeta[currentStep.value - 1]?.hint ?? '')
const progresoPct = computed(() => Math.round((currentStep.value / totalSteps) * 100))

const irAPaso = (paso: number) => {
  if (paso < currentStep.value) currentStep.value = paso
}

const datosEstudianteListos = computed(() =>
  nombreEstudiante.value.trim().length > 0 && cedulaEstudiante.value.trim().length > 0,
)

const canGoNext = computed(() => {
  if (!datosEstudianteListos.value) return false
  if (currentStep.value === 1)
    return !!formData.value.nombreCurso && materias.value.length > 0
  if (currentStep.value === 2)
    return !!formData.value.unidades && !!formData.value.actividades && !!archivo.value
  return true
})

const formularioCompleto = computed(() =>
  datosEstudianteListos.value
    && !!formData.value.nombreCurso
    && materias.value.length > 0
    && !!formData.value.unidades
    && !!formData.value.actividades
    && !!archivo.value,
)

const nextStep = () => { if (currentStep.value < totalSteps && canGoNext.value) currentStep.value++ }
const prevStep = () => { if (currentStep.value > 1) currentStep.value-- }

const cursoLabel = computed(() =>
  labelMateriaPorCodigo(formData.value.nombreCurso, materias.value)
)

const enviando = ref(false)

const enviar = async () => {
  const user = auth.currentUser
  if (!user || !formularioCompleto.value) return
  enviando.value = true

  try {
    if (!archivo.value) {
      await dialog.alert('Debes adjuntar el formato R-GA003 firmado en PDF.', { variant: 'error' })
      enviando.value = false
      return
    }

    let pdfUrl = ''
    const fd = new FormData()
    fd.append('file', archivo.value)
    fd.append('upload_preset', 'flexibilizaciones_pdf')
    const res = await fetch('https://api.cloudinary.com/v1_1/dhbehhvb5/image/upload', {
      method: 'POST', body: fd
    })
    const data = await res.json()
    if (!data.secure_url) {
      await dialog.alert('Error al subir el PDF', { variant: 'error' })
      enviando.value = false
      return
    }
    pdfUrl = data.secure_url

    await addDoc(collection(db, 'supletorios'), {
      estudiante_id: user.uid,
      estudiante_correo: user.email,
      nombre: nombreEstudiante.value,
      identificacion: cedulaEstudiante.value,
      semestre: formData.value.semestre,
      docente: formData.value.docente,
      nombre_curso: cursoLabel.value,
      curso_id: formData.value.nombreCurso,
      unidades: formData.value.unidades,
      actividades: formData.value.actividades,
      pdf_url: pdfUrl,
      estado: 'pendiente',
      motivo_rechazo: '',
      fecha_creacion: serverTimestamp(),
    })

    await notificarDirectores({
      titulo: 'Nueva solicitud de supletorio',
      mensaje: `${nombreEstudiante.value} solicitó supletorio para ${cursoLabel.value}.`,
      tipo: 'info',
      ruta: '/director/solicitudes',
    })

    await cargarSolicitudes(user.uid)
    emit('crear', { ...formData.value })

    formData.value = {
      semestre: '', docente: '', nombreCurso: '',
      unidades: '', actividades: '',
    }
    archivo.value = null
    archivoNombre.value = ''
    currentStep.value = 1
    await dialog.alert('Solicitud de supletorio enviada correctamente.', { variant: 'success', title: 'Listo' })
  } catch (error) {
    console.error('Error al enviar supletorio:', error)
    await dialog.alert('Hubo un error al enviar la solicitud.', { variant: 'error', title: 'Error' })
  } finally {
    enviando.value = false
  }
}

const solicitarEnvio = async () => {
  if (!formularioCompleto.value) {
    if (!datosEstudianteListos.value) {
      await dialog.alert('No encontramos tu nombre o cédula en el sistema. Contacta a la institución.', { variant: 'error' })
    }
    return
  }

  const ok = await confirmarSolicitudEstudiante(
    { nombre: nombreEstudiante.value, cedula: cedulaEstudiante.value },
    {
      tipo: 'supletorio',
      detalles: [
        { label: 'Materia', value: cursoLabel.value },
        { label: 'Semestre', value: formData.value.semestre || '—' },
        { label: 'Docente', value: formData.value.docente || '—' },
        { label: 'Unidades', value: formData.value.unidades },
        { label: 'Actividades', value: formData.value.actividades },
        { label: 'Formato firmado', value: archivoNombre.value || 'PDF adjunto' },
      ],
    },
    { titulo: 'Confirmar supletorio' },
  )
  if (ok) await enviar()
}

const iniciarSolicitudesEstudiante = async (uid: string) => {
  const cached = leerCacheSolicitudes<any>(uid, TIPO_SOLICITUD)
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
  if (sesion?.cedula) cedulaEstudiante.value = sesion.cedula

  cargarMaterias()
})
</script>

<template>
  <div class="sol-page sol-page--sup">
    <div class="sol-layout">
      <aside class="sol-sidebar">
        <section class="sol-pendientes">
          <div class="sol-pendientes-header">
            <h2 class="sol-pendientes-title">Mis supletorios</h2>
            <span class="sol-pendientes-badge">{{ solicitudesPendientes.length }}</span>
          </div>

          <div v-if="solicitudesPendientes.length" class="sol-pendientes-list">
            <div v-for="sol in solicitudesPendientes" :key="sol.id" class="sol-pendiente-card">
              <div class="sol-pendiente-row">
                <div class="sol-pendiente-left">
                  <span class="sol-pendiente-id">#{{ sol.id }}</span>
                  <span class="sol-pendiente-curso">{{ sol.curso }}</span>
                </div>
                <div class="sol-pendiente-actions">
                  <span class="sol-pendiente-fecha">{{ formatFecha(sol.fecha) }}</span>
                  <span :class="['sol-estado-chip',
                    sol.estado === 'Aprobada' ? 'sol-estado-aprobada' :
                    sol.estado === 'Rechazada' ? 'sol-estado-rechazada' : 'sol-estado-pendiente'
                  ]">{{ sol.estado }}</span>
                </div>
              </div>
              <div v-if="sol.motivo_rechazo && sol.estado === 'Rechazada'" class="sol-motivo-rechazo">
                <span class="sol-motivo-rechazo-label">Motivo de rechazo</span>
                <p class="sol-motivo-rechazo-text">{{ sol.motivo_rechazo }}</p>
              </div>
            </div>
          </div>

          <p v-else class="sol-pendientes-empty">No tienes solicitudes de supletorios.</p>
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
            <div v-if="currentStep === 1" class="sol-step-content">
              <div class="sol-step-header">
                <h2>Selección de materia</h2>
                <p>Elige la materia del supletorio; la información del curso se mostrará automáticamente</p>
              </div>
              <div class="sol-form-grid">
                <div class="sol-form-group full-width">
                  <label class="sol-form-label"><span class="sol-required">*</span> Materia</label>
                  <MateriaPicker
                    v-if="materias.length"
                    v-model="formData.nombreCurso"
                    :materias="materias"
                  />
                  <p v-else class="sol-form-hint">No hay materias registradas.</p>
                </div>

                <div v-if="materiaSeleccionada" class="sol-form-group full-width">
                  <MateriaInfoPanel :materia="materiaSeleccionada" />
                </div>
              </div>
            </div>

            <div v-if="currentStep === 2" class="sol-step-content">
              <div class="sol-step-header">
                <h2>Actividades y soporte</h2>
                <p>Describe las actividades y adjunta el formato oficial firmado</p>
              </div>
              <div class="sol-form-grid">
                <div class="sol-form-group full-width">
                  <label class="sol-form-label"><span class="sol-required">*</span> Unidades</label>
                  <input v-model="formData.unidades" type="text" class="sol-form-input" placeholder="Ej. Unidad 2" />
                </div>
                <div class="sol-form-group full-width">
                  <label class="sol-form-label"><span class="sol-required">*</span> Actividades</label>
                  <input v-model="formData.actividades" type="text" class="sol-form-input" placeholder="Nombre de las actividades" />
                </div>
                <div class="sol-form-group full-width">
                  <label class="sol-form-label"><span class="sol-required">*</span> Formato R-GA003 firmado <span class="sol-label-hint">(PDF obligatorio)</span></label>
                  <PdfUploadArea
                    :file-name="archivoNombre"
                    hint="PDF firmado · Máx. 5 MB"
                    required
                    @select="onPdfSelect"
                    @error="onPdfError"
                  />
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
                :disabled="!canGoNext || enviando"
                @click="solicitarEnvio"
              >
                <span v-if="enviando" class="sol-btn-spinner"/>
                {{ enviando ? 'Enviando...' : 'Enviar solicitud' }}
              </button>
            </div>
          </footer>
        </section>
      </main>
    </div>
  </div>
</template>
