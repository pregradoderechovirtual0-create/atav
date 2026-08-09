<script setup lang="ts">
import { ref } from 'vue'
import { dialog } from '@/lib/dialog'

interface FormularioInasistenciaData {
  tipo: 'inasistencia'
  estado: 'pendiente'
  materia: string
  descripcion: string
  datos: {
    materia: string
    motivo: string
    excusa: string
  }
}

const emit = defineEmits<{
  crear: [data: FormularioInasistenciaData]
}>()

const formData = ref({
  materia: '',
  motivo: '',
  excusa: ''
})

const isSubmitting = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const handleSubmit = async () => {
  if (!formData.value.materia || !formData.value.motivo || !formData.value.excusa) {
    await dialog.alert('Por favor completa todos los campos', { variant: 'error' })
    return
  }
  isSubmitting.value = true
  try {
    emit('crear', {
      tipo: 'inasistencia',
      estado: 'pendiente',
      materia: formData.value.materia,
      descripcion: formData.value.motivo,
      datos: { ...formData.value }
    })
    formData.value = { materia: '', motivo: '', excusa: '' }
  } finally {
    isSubmitting.value = false
  }
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) formData.value.excusa = file.name
}

const triggerFileInput = () => fileInput.value?.click()
</script>

<template>
  <form @submit.prevent="handleSubmit" class="formulario-inasistencia">
    <h2 class="form-title">Solicitud de Justificación de Inasistencia</h2>
    <div class="form-description">
      <p>Completa los siguientes datos para justificar tu inasistencia a clase</p>
    </div>
    <div class="form-grid">
      <div class="form-group full-width">
        <label class="form-label"><span class="required">*</span> Materia a la cual pretende faltar</label>
        <input v-model="formData.materia" type="text" placeholder="Ej: Base de Datos - Grupo B" class="form-input" />
      </div>
      <div class="form-group full-width">
        <label class="form-label"><span class="required">*</span> Motivo de la inasistencia</label>
        <textarea v-model="formData.motivo" placeholder="Describe el motivo..." class="form-textarea" rows="4" />
      </div>
      <div class="form-group full-width">
        <label class="form-label"><span class="required">*</span> Adjuntar excusa</label>
        <div class="file-upload-container">
          <input ref="fileInput" type="file" @change="handleFileChange" class="hidden-file-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
          <button type="button" @click="triggerFileInput" class="file-upload-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Seleccionar archivo
          </button>
          <span v-if="formData.excusa" class="file-name">{{ formData.excusa }}</span>
          <p v-else class="file-hint">PDF, Word o Imagen (máx 5MB)</p>
        </div>
      </div>
    </div>
    <div class="form-actions">
      <button type="submit" :disabled="isSubmitting" class="btn-submit">
        {{ isSubmitting ? 'Enviando...' : 'Enviar Solicitud' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.formulario-inasistencia {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.form-description {
  background: #f0f4f8;
  padding: 1rem;
  border-radius: 0.5rem;
  border-left: 4px solid #3b82f6;
}

.form-description p {
  margin: 0;
  color: #4b5563;
  font-size: 0.9rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-weight: 600;
  color: #1a1a1a;
  font-size: 0.9rem;
  display: flex;
  gap: 0.25rem;
}

.required {
  color: #dc2626;
  font-weight: 700;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.file-upload-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem;
  border: 2px dashed #d1d5db;
  border-radius: 0.5rem;
  background: #f9fafb;
  transition: all 0.2s;
}

.file-upload-container:hover {
  border-color: #3b82f6;
  background: #f0f4f8;
}

.hidden-file-input {
  display: none;
}

.file-upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.file-upload-btn:hover {
  background: #2563eb;
}

.file-name {
  color: #059669;
  font-weight: 500;
  font-size: 0.9rem;
}

.file-hint {
  margin: 0;
  color: #9ca3af;
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.btn-submit {
  padding: 0.75rem 2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-submit:hover:not(:disabled) {
  background: #2563eb;
}

.btn-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    justify-content: stretch;
  }

  .btn-submit {
    width: 100%;
  }
}
</style>
