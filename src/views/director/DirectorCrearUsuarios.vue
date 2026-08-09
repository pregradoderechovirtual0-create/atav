<script setup lang="ts">
import { db } from '@/lib/firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { dialog } from '@/lib/dialog'
const router = useRouter()

const currentStep = ref(1)
const selectedRol = ref('')

const formData = ref({
  cedula: '',
  nombre: '',
  correo: ''
})

const roles = [
  { id: 'Docente', label: 'Docente', description: 'Acceso a solicitudes y gestion academica' },
  { id: 'Estudiante', label: 'Estudiante', description: 'Crear y consultar solicitudes' },
  { id: 'Director', label: 'Practicante', description: 'Gestion y aprobacion de solicitudes' },
]

// ── Toast ─────────────────────────────────────────────────────────
const toastVisible = ref(false)

const mostrarToast = () => {
  toastVisible.value = true
  setTimeout(() => { toastVisible.value = false }, 3500)
}

const nextStep = () => {
  if (currentStep.value < 2) currentStep.value++
}

const prevStep = () => {
  if (currentStep.value > 1) currentStep.value--
}

const crearUsuario = async () => {
  const { cedula, nombre, correo } = formData.value

  if (!selectedRol.value || !cedula || !nombre || !correo) {
    await dialog.alert('Completa todos los campos', { variant: 'error' })
    return
  }

  if (!/^\d+$/.test(cedula)) {
    await dialog.alert('La cédula debe ser numérica', { variant: 'error' })
    return
  }

  try {
    const userRef = doc(db, 'usuarios', cedula)

    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      await dialog.alert('Este usuario ya existe', { variant: 'error' })
      return
    }

    await setDoc(userRef, {
      cedula,
      nombre,
      correo,
      rol: selectedRol.value,
      registrado: false,
      createdAt: new Date()
    })

   mostrarToast()

selectedRol.value = ''
formData.value = { cedula: '', nombre: '', correo: '' }
currentStep.value = 1

setTimeout(() => {
  router.push('/director/usuarios')
}, 1500)

  } catch (error) {
    console.error(error)
    await dialog.alert('Error al crear usuario', { variant: 'error' })
  }
}
</script>

<template>
  <div class="crear-solicitud">

    <!-- ── Toast ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastVisible" class="toast">
          <div class="toast-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span>Usuario creado exitosamente</span>
        </div>
      </Transition>
    </Teleport>

    <!-- Steps -->
    <div class="steps-container">
      <div class="steps">
        <div :class="['step', { active: currentStep >= 1, completed: currentStep > 1 }]">
          <div class="step-number">
            <svg v-if="currentStep > 1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span v-else>1</span>
          </div>
          <span class="step-label">Rol</span>
        </div>

        <div class="step-line" :class="{ active: currentStep > 1 }"></div>

        <div :class="['step', { active: currentStep >= 2 }]">
          <div class="step-number">2</div>
          <span class="step-label">Datos</span>
        </div>
      </div>
    </div>

    <!-- Form -->
    <div class="form-container">

      <!-- Step 1 -->
      <div v-if="currentStep === 1" class="step-content">
        <div class="step-header">
          <h2>Tipo de usuario</h2>
          <p>Selecciona el rol que deseas crear</p>
        </div>

        <div class="tipo-grid">
          <button
            v-for="rol in roles"
            :key="rol.id"
            :class="['tipo-card', { selected: selectedRol === rol.id }]"
            @click="selectedRol = rol.id"
          >
            <div class="tipo-radio">
              <div class="radio-inner"></div>
            </div>
            <div class="tipo-content">
              <span class="tipo-label">{{ rol.label }}</span>
              <span class="tipo-description">{{ rol.description }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Step 2 -->
      <div v-if="currentStep === 2" class="step-content">
        <div class="step-header">
          <h2>Datos del usuario</h2>
          <p>Completa la información</p>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Cédula</label>
            <input v-model="formData.cedula" type="text" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input v-model="formData.nombre" type="text" class="form-input" />
          </div>

          <div class="form-group full-width">
            <label class="form-label">Correo</label>
            <input v-model="formData.correo" type="email" class="form-input" />
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button v-if="currentStep > 1" class="btn btn-secondary" @click="prevStep">
          Anterior
        </button>

        <div class="actions-right">
          <router-link to="/director/usuarios/" class="btn btn-ghost">Cancelar</router-link>

          <button
            v-if="currentStep < 2"
            class="btn btn-primary"
            @click="nextStep"
            :disabled="!selectedRol"
          >
            Siguiente
          </button>

          <button
            v-else
            class="btn btn-primary"
            @click="crearUsuario"
          >
            Crear usuario
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crear-solicitud {
  max-width: 680px;
  margin: 0 auto;
}

/* ── Toast ──────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #18181b;
  color: #fff;
  padding: 13px 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  pointer-events: none;
}

.toast-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #22c55e;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Animación */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* Steps */
.steps-container { margin-bottom: 32px; }
.steps { display: flex; align-items: center; justify-content: center; }
.step { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.step-number {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-border-light); color: var(--color-text-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; transition: all var(--transition);
}
.step.active .step-number { background: var(--color-primary); color: white; }
.step.completed .step-number { background: var(--color-success); color: white; }
.step-label { font-size: 12px; color: var(--color-text-muted); font-weight: 500; }
.step.active .step-label { color: var(--color-text); }
.step-line {
  width: 80px; height: 2px; background: var(--color-border-light);
  margin: 0 8px 24px; transition: all var(--transition);
}
.step-line.active { background: var(--color-primary); }

/* Form Container */
.form-container {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); padding: 32px;
}
.step-content { min-height: 260px; }
.step-header { margin-bottom: 24px; }
.step-header h2 { font-size: 18px; font-weight: 600; color: var(--color-text); margin-bottom: 4px; }
.step-header p { font-size: 14px; color: var(--color-text-secondary); }

/* Cards */
.tipo-grid { display: flex; flex-direction: column; gap: 10px; }
.tipo-card {
  display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px;
  border: 1px solid var(--color-border); border-radius: var(--radius);
  text-align: left; transition: all var(--transition); background: var(--color-surface);
}
.tipo-card:hover { border-color: var(--color-text-muted); }
.tipo-card.selected { border-color: var(--color-accent); background: var(--color-info-bg); }
.tipo-radio {
  width: 18px; height: 18px; border: 2px solid var(--color-border); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 2px; transition: all var(--transition);
}
.tipo-card.selected .tipo-radio { border-color: var(--color-accent); }
.radio-inner {
  width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent);
  transform: scale(0); transition: transform var(--transition);
}
.tipo-card.selected .radio-inner { transform: scale(1); }
.tipo-content { display: flex; flex-direction: column; gap: 2px; }
.tipo-label { font-size: 14px; font-weight: 500; color: var(--color-text); }
.tipo-description { font-size: 12px; color: var(--color-text-secondary); }

/* Form */
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group.full-width { grid-column: 1 / -1; }
.form-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
.form-input {
  padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius); font-size: 14px; color: var(--color-text);
  background: var(--color-surface); transition: all var(--transition);
}
.form-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

/* Actions */
.form-actions {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--color-border-light);
}
.actions-right { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px;
  border-radius: var(--radius); font-size: 13px; font-weight: 500;
  transition: all var(--transition);
}
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-light); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text); }
.btn-secondary:hover { background: var(--color-background); }
.btn-ghost { color: var(--color-text-secondary); }
.btn-ghost:hover { color: var(--color-text); }

@media (max-width: 768px) {
  .form-container { padding: 24px; }
  .form-grid { grid-template-columns: 1fr; }
  .step-line { width: 40px; }
  .toast { bottom: 16px; right: 16px; left: 16px; }
}
</style>