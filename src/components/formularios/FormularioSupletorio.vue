<script setup lang="ts">
import { ref, computed } from 'vue'

interface FormularioSupletorioData {
  tipo: 'supletorio'
  estado: 'pendiente'
  datos: {
    semestre: string
    docente: string
    nombreCurso: string
    nombreEstudiante: string
    documentoEstudiante: string
    unidades: string
    actividades: string
  }
}

const emit = defineEmits<{
  crear: [data: FormularioSupletorioData]
}>()

// ── Estado de pasos ──────────────────────────────────────────────
const currentStep = ref(1)
const totalSteps = 3

// ── Datos del formulario ─────────────────────────────────────────
const formData = ref({
  // Paso 1: Estudiante
  nombreEstudiante: '',
  documentoEstudiante: '',

  // Paso 2: Curso
  semestre: '',
  docente: '',
  nombreCurso: '',

  // Paso 3: Actividades
  unidades: '',
  actividades: ''
})

// ── Opciones ─────────────────────────────────────────────────────
const semestres = [
  { id: '1', label: 'Primer Semestre' },
  { id: '2', label: 'Segundo Semestre' },
  { id: '3', label: 'Tercer Semestre' },
  { id: '4', label: 'Cuarto Semestre' },
  { id: '5', label: 'Quinto Semestre' },
  { id: '6', label: 'Sexto Semestre' },
  { id: '7', label: 'Séptimo Semestre' },
  { id: '8', label: 'Octavo Semestre' },
  { id: '9', label: 'Noveno Semestre' },
  { id: '10', label: 'Décimo Semestre' },
]

// ── Validación de pasos ──────────────────────────────────────────
const canGoNext = computed(() => {
  if (currentStep.value === 1)
    return !!formData.value.nombreEstudiante && !!formData.value.documentoEstudiante
  if (currentStep.value === 2)
    return !!formData.value.semestre && !!formData.value.docente && !!formData.value.nombreCurso
  if (currentStep.value === 3)
    return !!formData.value.unidades && !!formData.value.actividades
  return true
})

// ── Navegación ────────────────────────────────────────────────────
const nextStep = () => { if (currentStep.value < totalSteps) currentStep.value++ }
const prevStep = () => { if (currentStep.value > 1) currentStep.value-- }

// ── Submit ────────────────────────────────────────────────────────
const isSubmitting = ref(false)

const handleSubmit = () => {
  isSubmitting.value = true

  try {
    emit('crear', {
      tipo: 'supletorio',
      estado: 'pendiente',
      datos: { ...formData.value }
    })

    // Resetear formulario
    formData.value = {
      nombreEstudiante: '',
      documentoEstudiante: '',
      semestre: '',
      docente: '',
      nombreCurso: '',
      unidades: '',
      actividades: ''
    }
    currentStep.value = 1
  } finally {
    isSubmitting.value = false
  }
}

// ── Labels de pasos ──────────────────────────────────────────────
const stepLabels = ['Estudiante', 'Curso', 'Actividades']
</script>

<template>
  <div class="formulario-supletorio">
    <!-- Steps indicator -->
    <div class="steps-container">
      <div class="steps">
        <template v-for="(label, idx) in stepLabels" :key="idx">
          <div :class="['step', { active: currentStep >= idx + 1, completed: currentStep > idx + 1 }]">
            <div class="step-number">{{ idx + 1 }}</div>
            <div class="step-label">{{ label }}</div>
          </div>
          <div v-if="idx < stepLabels.length - 1" class="step-line" :class="{ active: currentStep > idx + 1 }"></div>
        </template>
      </div>
    </div>

    <!-- Form -->
    <div class="form-container">

      <!-- Paso 1: Información del estudiante -->
      <div v-if="currentStep === 1" class="step-content">
        <div class="step-header">
          <h2>Información del estudiante</h2>
          <p>Ingresa tus datos personales</p>
        </div>
        <div class="form-grid">
          <div class="form-group full-width">
            <label class="form-label">
              <span class="required">*</span>
              Nombre y apellidos del estudiante
            </label>
            <input
              v-model="formData.nombreEstudiante"
              type="text"
              placeholder="Escriba su nombre completo"
              class="form-input"
            />
          </div>
          <div class="form-group full-width">
            <label class="form-label">
              <span class="required">*</span>
              Documento de identificación del estudiante
            </label>
            <input
              v-model="formData.documentoEstudiante"
              type="text"
              placeholder="Escriba su número de documento"
              class="form-input"
            />
          </div>
        </div>
      </div>

      <!-- Paso 2: Información del curso -->
      <div v-if="currentStep === 2" class="step-content">
        <div class="step-header">
          <h2>Información del curso</h2>
          <p>Completa los datos del curso correspondiente</p>
        </div>
        <div class="form-grid">
          <div class="form-group full-width">
            <label class="form-label">
              <span class="required">*</span>
              Semestre que corresponde la materia del supletorio
            </label>
            <select v-model="formData.semestre" class="form-input">
              <option value="">Selecciona el semestre</option>
              <option v-for="sem in semestres" :key="sem.id" :value="sem.id">
                {{ sem.label }}
              </option>
            </select>
          </div>
          <div class="form-group full-width">
            <label class="form-label">
              <span class="required">*</span>
              Docente que dicta el curso
            </label>
            <input
              v-model="formData.docente"
              type="text"
              placeholder="Escriba el nombre del docente"
              class="form-input"
            />
          </div>
          <div class="form-group full-width">
            <label class="form-label">
              <span class="required">*</span>
              Nombre del curso
            </label>
            <input
              v-model="formData.nombreCurso"
              type="text"
              placeholder="Escriba el nombre del curso"
              class="form-input"
            />
          </div>
        </div>
      </div>

      <!-- Paso 3: Actividades -->
      <div v-if="currentStep === 3" class="step-content">
        <div class="step-header">
          <h2>Información de actividades</h2>
          <p>Describe las unidades y actividades correspondientes</p>
        </div>
        <div class="form-grid">
          <div class="form-group full-width">
            <label class="form-label">
              <span class="required">*</span>
              Unidad(es) donde se encuentran la(s) actividad(es)
            </label>
            <input
              v-model="formData.unidades"
              type="text"
              placeholder="Escriba las unidades"
              class="form-input"
            />
          </div>
          <div class="form-group full-width">
            <label class="form-label">
              <span class="required">*</span>
              Indicar el nombre de la(s) actividad(es)
            </label>
            <input
              v-model="formData.actividades"
              type="text"
              placeholder="Escriba el nombre de las actividades"
              class="form-input"
            />
          </div>
        </div>
      </div>

      <!-- Acciones -->
      <div class="form-actions">
        <button v-if="currentStep > 1" class="btn btn-secondary" @click="prevStep">
          Anterior
        </button>

        <div class="actions-right">
          <button
            v-if="currentStep < totalSteps"
            class="btn btn-primary"
            :disabled="!canGoNext"
            @click="nextStep"
          >
            Siguiente
          </button>
          <button
            v-if="currentStep === totalSteps"
            type="button"
            class="btn btn-primary"
            :disabled="!canGoNext || isSubmitting"
            @click="handleSubmit"
          >
            {{ isSubmitting ? 'Enviando...' : 'Enviar Solicitud' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.formulario-supletorio {
  max-width: 720px;
  margin: 0 auto;
}

/* ── Steps ─────────────────────────────────────────────────────── */
.steps-container {
  margin-bottom: 28px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 520px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-number {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-border-light);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  transition: all var(--transition, 0.2s);
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
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.step.active .step-label {
  color: var(--color-text);
}

.step-line {
  flex: 1;
  min-width: 24px;
  max-width: 56px;
  height: 2px;
  background: var(--color-border-light);
  margin: 0 4px 22px;
  transition: all var(--transition, 0.2s);
}

.step-line.active {
  background: var(--color-primary);
}

/* ── Form container ─────────────────────────────────────────────── */
.form-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 32px;
}

.step-content {
  min-height: 200px;
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

/* ── Form grid ──────────────────────────────────────────────────── */
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

.required {
  color: #dc2626;
  font-weight: 700;
}

.form-input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-surface);
  transition: all var(--transition, 0.2s);
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

.form-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  outline: none;
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Actions ─────────────────────────────────────────────────────*/
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
  transition: all var(--transition, 0.2s);
  cursor: pointer;
  text-decoration: none;
  border: none;
  background: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-light);
}

.btn-primary:disabled {
  opacity: 0.45;
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

/* ── Responsive ──────────────────────────────────────────────────*/
@media (max-width: 640px) {
  .form-container {
    padding: 20px 16px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
