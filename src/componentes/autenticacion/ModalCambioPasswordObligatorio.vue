<script setup lang="ts">
import { ref } from 'vue'
import {
  establecerPasswordPropio,
  CambioPasswordError,
} from '@/lib/autenticacion/cambiarPasswordPropio'

const props = defineProps<{
  cedula: string
}>()

const emit = defineEmits<{
  completado: []
}>()

const contraseñaAsignada = ref('')
const nuevaPassword = ref('')
const confirmarPassword = ref('')
const mostrarAsignada = ref(false)
const mostrarNueva = ref(false)
const mostrarConfirmar = ref(false)
const guardando = ref(false)
const error = ref('')

const enviar = async () => {
  error.value = ''

  if (!contraseñaAsignada.value || !nuevaPassword.value || !confirmarPassword.value) {
    error.value = 'Completa todos los campos'
    return
  }

  if (nuevaPassword.value !== confirmarPassword.value) {
    error.value = 'Las contraseñas nuevas no coinciden'
    return
  }

  try {
    guardando.value = true
    await establecerPasswordPropio(
      props.cedula,
      contraseñaAsignada.value,
      nuevaPassword.value,
    )
    contraseñaAsignada.value = ''
    nuevaPassword.value = ''
    confirmarPassword.value = ''
    emit('completado')
  } catch (err) {
    error.value =
      err instanceof CambioPasswordError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'No se pudo guardar la contraseña'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cambio-password-title">
    <div class="modal-card modal-form">
      <div class="modal-top">
        <div class="modal-top-row">
          <div class="modal-icon modal-icon--warning" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div class="modal-top-text">
            <h2 id="cambio-password-title" class="modal-title">Crea tu contraseña personal</h2>
            <p class="modal-subtitle">
              Administración restableció tu acceso. Por seguridad, elige una contraseña nueva que solo tú conozcas.
            </p>
          </div>
        </div>
      </div>

      <form class="modal-body modal-form-body" @submit.prevent="enviar">
        <div class="field-group">
          <label class="field-label" for="pwd-asignada">Contraseña asignada por administración</label>
          <div class="field-with-icon">
            <input
              id="pwd-asignada"
              v-model="contraseñaAsignada"
              class="field-input field-input-icon"
              :type="mostrarAsignada ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="La que te dio el director"
              required
            />
            <button
              type="button"
              class="toggle-password"
              :aria-label="mostrarAsignada ? 'Ocultar' : 'Mostrar'"
              @click="mostrarAsignada = !mostrarAsignada"
            >
              {{ mostrarAsignada ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="pwd-nueva">Tu nueva contraseña</label>
          <div class="field-with-icon">
            <input
              id="pwd-nueva"
              v-model="nuevaPassword"
              class="field-input field-input-icon"
              :type="mostrarNueva ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Mínimo 6 caracteres"
              required
            />
            <button
              type="button"
              class="toggle-password"
              :aria-label="mostrarNueva ? 'Ocultar' : 'Mostrar'"
              @click="mostrarNueva = !mostrarNueva"
            >
              {{ mostrarNueva ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="pwd-confirmar">Confirmar nueva contraseña</label>
          <div class="field-with-icon">
            <input
              id="pwd-confirmar"
              v-model="confirmarPassword"
              class="field-input field-input-icon"
              :type="mostrarConfirmar ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Repite tu contraseña"
              required
            />
            <button
              type="button"
              class="toggle-password"
              :aria-label="mostrarConfirmar ? 'Ocultar' : 'Mostrar'"
              @click="mostrarConfirmar = !mostrarConfirmar"
            >
              {{ mostrarConfirmar ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
        </div>

        <p v-if="error" class="form-error">{{ error }}</p>

        <div class="modal-footer">
          <button type="submit" class="btn-primary-full" :disabled="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar mi contraseña' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
  width: 100%;
  max-width: 480px;
  overflow: hidden;
}

.modal-top {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--color-border-light);
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

.modal-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
}

.modal-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.modal-body {
  padding: 20px 24px 24px;
}

.modal-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-icon--warning {
  background: #fef3c7;
  color: #b45309;
}

.modal-form-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.field-with-icon {
  position: relative;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 72px 10px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
  background: var(--color-surface);
  color: var(--color-text);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.toggle-password {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
}

.form-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.btn-primary-full {
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition);
}

.btn-primary-full:hover:not(:disabled) {
  background: var(--color-primary-light);
}

.btn-primary-full:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.modal-footer {
  padding-top: 4px;
}
</style>
