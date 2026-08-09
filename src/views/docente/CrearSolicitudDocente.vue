<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { notificarDirectores } from '@/lib/notificaciones'
import { fetchMaterias, filtrarMateriasPorProfesor, labelMateria, type MateriaRegistrada } from '@/lib/materias'
import {
  TIPOS_AUSENTISMO,
  TIPOS_REPROGRAMACION,
  crearSolicitudDocente,
} from '@/lib/docenteSolicitudes'
import { dialog } from '@/lib/dialog'

const router = useRouter()
const currentStep = ref(1)
const selectedTipo = ref('')
const enviando = ref(false)
const docenteNombre = ref('')
const materias = ref<MateriaRegistrada[]>([])
const materiasDocente = ref<MateriaRegistrada[]>([])

const formData = ref({
  fechaInicio: '',
  fechaFin: '',
  materiaCodigo: '',
  descripcion: '',
  tipoReprogramacion: '',
  fechasReprogramacion: ['', '', ''],
})

const tiposAusentismo = TIPOS_AUSENTISMO
const tiposReprogramacion = TIPOS_REPROGRAMACION

const materiaSeleccionada = computed(() =>
  materiasDocente.value.find(m => m.codigo === formData.value.materiaCodigo)
)

const canGoNext = computed(() => {
  if (currentStep.value === 1) return !!selectedTipo.value
  if (currentStep.value === 2) {
    return !!formData.value.fechaInicio
      && !!formData.value.fechaFin
      && !!formData.value.materiaCodigo
      && !!formData.value.descripcion.trim()
  }
  if (currentStep.value === 3) {
    return !!formData.value.tipoReprogramacion && !!formData.value.fechasReprogramacion[0]
  }
  return true
})

const cargarMateriasDocente = async () => {
  materias.value = await fetchMaterias()
  if (!docenteNombre.value) {
    materiasDocente.value = []
    return
  }
  materiasDocente.value = filtrarMateriasPorProfesor(materias.value, docenteNombre.value)
}

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return
    const cedula = localStorage.getItem('cedula')
    if (cedula) {
      const snap = await getDoc(doc(db, 'usuarios', cedula))
      if (snap.exists()) docenteNombre.value = snap.data().nombre || ''
    }
    await cargarMateriasDocente()
  })
})

const archivo = ref<File | null>(null)
const archivoNombre = ref('')

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    archivo.value = file
    archivoNombre.value = file.name
  } else {
    dialog.alert('Solo se permiten archivos PDF.', { variant: 'error' })
    input.value = ''
  }
}

const formularioCompleto = computed(() =>
  !!selectedTipo.value
    && !!formData.value.fechaInicio
    && !!formData.value.fechaFin
    && !!formData.value.materiaCodigo
    && !!formData.value.descripcion.trim()
    && !!formData.value.tipoReprogramacion
    && !!formData.value.fechasReprogramacion[0],
)

const nextStep = () => {
  if (currentStep.value < 3 && canGoNext.value) currentStep.value++
}

const prevStep = () => {
  if (currentStep.value > 1) currentStep.value--
}

const mensajeErrorFirebase = (error: unknown) => {
  if (error instanceof Error && error.message && !error.message.includes('Firebase')) {
    return error.message
  }
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : ''
  if (code === 'permission-denied') {
    return 'No tienes permiso para guardar la solicitud. Verifica que las reglas de Firestore incluyan la colección «solicitudes».'
  }
  return 'No se pudo enviar la solicitud. Intenta de nuevo.'
}

const enviar = async () => {
  if (!formularioCompleto.value) {
    await dialog.alert('Completa todos los pasos antes de enviar la solicitud.', { variant: 'warning' })
    return
  }
  enviando.value = true

  try {
    const user = auth.currentUser
    if (!user) {
      await dialog.alert('Tu sesión expiró. Vuelve a iniciar sesión.', { variant: 'error' })
      router.push('/')
      return
    }

    let pdfUrl = ''
    if (archivo.value) {
      const formDataCloud = new FormData()
      formDataCloud.append('file', archivo.value)
      formDataCloud.append('upload_preset', 'flexibilizaciones_pdf')

      const res = await fetch(
        'https://api.cloudinary.com/v1_1/dhbehhvb5/image/upload',
        { method: 'POST', body: formDataCloud }
      )
      const data = await res.json()

      if (!data.secure_url) {
        await dialog.alert('Error al subir el PDF', { variant: 'error' })
        enviando.value = false
        return
      }
      pdfUrl = data.secure_url
    }

    const materia = materiaSeleccionada.value
    const fechas = formData.value.fechasReprogramacion.filter(Boolean)

    await crearSolicitudDocente({
      usuario_id: user.uid,
      cedula: localStorage.getItem('cedula') || '',
      docente_nombre: docenteNombre.value,
      tipo_ausentismo: selectedTipo.value,
      fecha_inicio: formData.value.fechaInicio,
      fecha_fin: formData.value.fechaFin,
      materia_codigo: formData.value.materiaCodigo,
      materia_label: materia ? labelMateria(materia) : formData.value.materiaCodigo,
      descripcion: formData.value.descripcion.trim(),
      tipo_reprogramacion: formData.value.tipoReprogramacion,
      fechas_reprogramacion: fechas,
      pdf_url: pdfUrl,
    })

    void notificarDirectores({
      titulo: 'Nueva solicitud de docente',
      mensaje: `${docenteNombre.value || 'Un docente'} solicitó ausencia para ${materia ? labelMateria(materia) : formData.value.materiaCodigo}.`,
      tipo: 'info',
      ruta: '/director/solicitudes',
    })

    router.push('/docente/mis-solicitudes')
  } catch (error) {
    console.error('Error al enviar solicitud docente:', error)
    await dialog.alert(mensajeErrorFirebase(error), { variant: 'error', title: 'Error' })
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="crear-solicitud role-page">
    <!-- Progress Steps -->
    <div class="steps-container">
      <div class="steps">
        <div :class="['step', { active: currentStep >= 1, completed: currentStep > 1 }]">
          <div class="step-number">
            <svg v-if="currentStep > 1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span v-else>1</span>
          </div>
          <span class="step-label">Tipo</span>
        </div>
        <div class="step-line" :class="{ active: currentStep > 1 }"></div>
        <div :class="['step', { active: currentStep >= 2, completed: currentStep > 2 }]">
          <div class="step-number">
            <svg v-if="currentStep > 2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span v-else>2</span>
          </div>
          <span class="step-label">Detalles</span>
        </div>
        <div class="step-line" :class="{ active: currentStep > 2 }"></div>
        <div :class="['step', { active: currentStep >= 3 }]">
          <div class="step-number">3</div>
          <span class="step-label">Reprogramacion</span>
        </div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="form-container">
      <!-- Step 1: Type Selection -->
      <div v-if="currentStep === 1" class="step-content">
        <div class="step-header">
          <h2>Tipo de ausentismo</h2>
          <p>Selecciona el motivo de tu solicitud</p>
        </div>
        <div class="tipo-grid">
          <button 
            v-for="tipo in tiposAusentismo" 
            :key="tipo.id"
            :class="['tipo-card', { selected: selectedTipo === tipo.id }]"
            @click="selectedTipo = tipo.id"
          >
            <div class="tipo-radio">
              <div class="radio-inner"></div>
            </div>
            <div class="tipo-content">
              <span class="tipo-label">{{ tipo.label }}</span>
              <span class="tipo-description">{{ tipo.description }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Step 2: Details -->
      <div v-if="currentStep === 2" class="step-content">
        <div class="step-header">
          <h2>Detalles de la solicitud</h2>
          <p>Completa la informacion requerida</p>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Fecha de inicio</label>
            <input 
              v-model="formData.fechaInicio"
              type="date" 
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de fin</label>
            <input 
              v-model="formData.fechaFin"
              type="date" 
              class="form-input"
            />
          </div>
          <div class="form-group full-width">
            <label class="form-label">Materia afectada</label>
            <p v-if="!materiasDocente.length" class="form-hint">
              No tienes materias asignadas. El director debe registrarte como profesor en Materias.
            </p>
            <select v-else v-model="formData.materiaCodigo" class="form-select">
              <option value="" disabled>Selecciona una materia</option>
              <option v-for="m in materiasDocente" :key="m.codigo" :value="m.codigo">
                {{ m.codigo }} — {{ m.nombre }}
              </option>
            </select>
          </div>
          <div class="form-group full-width">
            <label class="form-label">Descripcion</label>
            <textarea 
              v-model="formData.descripcion"
              class="form-textarea"
              rows="4"
              placeholder="Describe brevemente el motivo de tu solicitud..."
            ></textarea>
          </div>
          <div class="form-group full-width">
  <label class="form-label">Documento de soporte</label>
  <label class="file-upload">
    <input type="file" accept="application/pdf" style="display:none" @change="onFileChange" />
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    <span v-if="archivoNombre"><strong>{{ archivoNombre }}</strong></span>
    <span v-else>Arrastra archivos aqui o <strong>haz clic para seleccionar</strong></span>
    <span class="file-hint">PDF (max. 5MB)</span>
  </label>
</div>
        </div>
      </div>

      <!-- Step 3: Rescheduling -->
      <div v-if="currentStep === 3" class="step-content">
        <div class="step-header">
          <h2>Propuesta de reprogramacion</h2>
          <p>Indica como planeas reponer las clases</p>
        </div>
        <div class="repro-section">
          <label class="form-label">Tipo de reprogramacion</label>
          <div class="repro-options">
            <button 
              v-for="tipo in tiposReprogramacion" 
              :key="tipo.id"
              :class="['repro-option', { selected: formData.tipoReprogramacion === tipo.id }]"
              @click="formData.tipoReprogramacion = tipo.id"
            >
              <div class="repro-radio">
                <div class="radio-inner"></div>
              </div>
              <div class="repro-content">
                <span class="repro-label">{{ tipo.label }}</span>
                <span class="repro-description">{{ tipo.description }}</span>
              </div>
            </button>
          </div>
        </div>

        <div class="repro-section">
          <label class="form-label">Fechas propuestas (hasta 3 opciones)</label>
          <p class="form-hint">Maximo 8 dias despues de la ausencia</p>
          <div class="dates-grid">
            <div v-for="(_, index) in formData.fechasReprogramacion" :key="index" class="form-group">
              <span class="date-label">Opcion {{ index + 1 }} {{ index === 0 ? '*' : '(opcional)' }}</span>
              <input 
                v-model="formData.fechasReprogramacion[index]"
                type="datetime-local" 
                class="form-input"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="form-actions">
        <button v-if="currentStep > 1" class="btn btn-secondary" @click="prevStep">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Anterior
        </button>
        <div class="actions-right">
          <router-link to="/docente/dashboard" class="btn btn-ghost">Cancelar</router-link>
          <button
            v-if="currentStep < 3"
            class="btn btn-primary"
            @click="nextStep"
            :disabled="!canGoNext"
          >
            Siguiente
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button v-else class="btn btn-primary" :disabled="!canGoNext || enviando" @click="enviar">
            {{ enviando ? 'Enviando...' : 'Enviar solicitud' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Steps */
.steps-container {
  margin-bottom: 32px;
}

.steps {
  display: flex;
  align-items: center;
  justify-content: center;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-border-light);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  transition: all var(--transition);
}

.step.active .step-number {
  background: var(--color-primary);
  color: white;
}

.step.completed .step-number {
  background: var(--color-success);
  color: white;
}

.step-label {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.step.active .step-label {
  color: var(--color-text);
}

.step-line {
  width: 80px;
  height: 2px;
  background: var(--color-border-light);
  margin: 0 8px 24px;
  transition: all var(--transition);
}

.step-line.active {
  background: var(--color-primary);
}

/* Form Container */
.form-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 32px;
}

.step-content {
  min-height: 340px;
}

.step-header {
  margin-bottom: 24px;
}

.step-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.step-header p {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* Type Selection */
.tipo-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tipo-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  text-align: left;
  transition: all var(--transition);
  background: var(--color-surface);
}

.tipo-card:hover {
  border-color: var(--color-text-muted);
}

.tipo-card.selected {
  border-color: var(--color-accent);
  background: var(--color-info-bg);
}

.tipo-radio {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  transition: all var(--transition);
}

.tipo-card.selected .tipo-radio {
  border-color: var(--color-accent);
}

.radio-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  transform: scale(0);
  transition: transform var(--transition);
}

.tipo-card.selected .radio-inner {
  transform: scale(1);
}

.tipo-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tipo-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.tipo-description {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Form Fields */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: -4px;
  margin-bottom: 12px;
}

.form-input,
.form-select,
.form-textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-surface);
  transition: all var(--transition);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-select {
  cursor: pointer;
}

/* File Upload */
.file-upload {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition);
  font-size: 13px;
}

.file-upload:hover {
  border-color: var(--color-text-muted);
  background: var(--color-background);
}

.file-upload strong {
  color: var(--color-accent);
}

.file-hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* Reprogramming Section */
.repro-section {
  margin-bottom: 24px;
}

.repro-section .form-label {
  margin-bottom: 12px;
  display: block;
}

.repro-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.repro-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 16px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  transition: all var(--transition);
  background: var(--color-surface);
}

.repro-option:hover {
  border-color: var(--color-text-muted);
}

.repro-option.selected {
  border-color: var(--color-accent);
  background: var(--color-info-bg);
}

.repro-radio {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}

.repro-option.selected .repro-radio {
  border-color: var(--color-accent);
}

.repro-option.selected .radio-inner {
  transform: scale(1);
}

.repro-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.repro-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.repro-description {
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* Dates Grid */
.dates-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.date-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  display: block;
}

/* Form Actions */
.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border-light);
}

.actions-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-light);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-background);
}

.btn-ghost {
  color: var(--color-text-secondary);
}

.btn-ghost:hover {
  color: var(--color-text);
}

@media (max-width: 768px) {
  .form-container {
    padding: 24px;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .repro-options {
    grid-template-columns: 1fr;
  }
  
  .dates-grid {
    grid-template-columns: 1fr;
  }
  
  .step-line {
    width: 40px;
  }
}
</style>
