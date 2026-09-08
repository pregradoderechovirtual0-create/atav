<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { dialog } from '@/lib/nucleo/dialog'
import { restablecerPasswordUsuario, ResetPasswordError } from '@/lib/autenticacion/resetPassword'

const route = useRoute()
const router = useRouter()

const cedulaParam = route.params.cedula
const cedula = Array.isArray(cedulaParam) ? cedulaParam[0] : (cedulaParam as string)

const usuario = ref<Record<string, string> | null>(null)
const loading = ref(true)
const cambiando = ref(false)
const mensaje = ref('')
const mensajeTipo = ref<'ok' | 'error' | ''>('')

const nuevaPassword = ref('')
const confirmarPassword = ref('')

onMounted(async () => {
  try {
    const snap = await getDoc(doc(db, 'usuarios', cedula))
    if (snap.exists()) {
      usuario.value = { id: snap.id, ...snap.data() } as Record<string, string>
    }
  } catch (error) {
    console.error(error)
    mensaje.value = 'Error al cargar el usuario'
    mensajeTipo.value = 'error'
  } finally {
    loading.value = false
  }
})

const cambiarPasswordAdmin = async () => {
  mensaje.value = ''
  mensajeTipo.value = ''

  if (!usuario.value) {
    mensaje.value = 'No hay usuario cargado'
    mensajeTipo.value = 'error'
    return
  }

  if (!nuevaPassword.value.trim()) {
    mensaje.value = 'Debes ingresar la nueva contraseña'
    mensajeTipo.value = 'error'
    return
  }

  if (nuevaPassword.value.length < 6) {
    mensaje.value = 'La contraseña debe tener mínimo 6 caracteres'
    mensajeTipo.value = 'error'
    return
  }

  if (nuevaPassword.value !== confirmarPassword.value) {
    mensaje.value = 'Las contraseñas no coinciden'
    mensajeTipo.value = 'error'
    return
  }

  const nombre = [usuario.value.nombre, usuario.value.apellido].filter(Boolean).join(' ')
  const confirmar = await dialog.confirm(`¿Cambiar la contraseña de ${nombre || 'este usuario'}?`, {
    title: 'Confirmar cambio',
    confirmText: 'Cambiar contraseña',
  })
  if (!confirmar) return

  try {
    cambiando.value = true
    await restablecerPasswordUsuario(cedula, nuevaPassword.value)

    mensaje.value =
      'Contraseña temporal asignada. El usuario debe iniciar sesión con esa clave y el sistema le pedirá crear su contraseña personal.'
    mensajeTipo.value = 'ok'
    nuevaPassword.value = ''
    confirmarPassword.value = ''
    setTimeout(() => router.push('/director/usuarios'), 1800)
  } catch (error) {
    console.error(error)
    if (error instanceof ResetPasswordError) {
      mensaje.value = error.message
    } else {
      mensaje.value = error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.'
    }
    mensajeTipo.value = 'error'
  } finally {
    cambiando.value = false
  }
}
</script>

<template>
  <div class="role-page">
    <div v-if="loading" class="role-empty">Cargando usuario...</div>

    <div v-else-if="!usuario" class="role-panel">
      <p class="role-empty-inline">Usuario no encontrado</p>
      <button type="button" class="role-btn role-btn-secondary" @click="router.push('/director/usuarios')">
        Volver a usuarios
      </button>
    </div>

    <div v-else class="role-panel">
      <section class="usuario-resumen">
        <div class="role-info-grid">
          <div class="role-info-item">
            <span class="role-info-label">Nombre</span>
            <span class="role-info-value">{{ usuario.nombre }} {{ usuario.apellido }}</span>
          </div>
          <div class="role-info-item">
            <span class="role-info-label">Cédula</span>
            <span class="role-info-value">{{ usuario.cedula || usuario.id }}</span>
          </div>
          <div class="role-info-item">
            <span class="role-info-label">Correo</span>
            <span class="role-info-value">{{ usuario.correo || '—' }}</span>
          </div>
          <div class="role-info-item">
            <span class="role-info-label">Rol</span>
            <span class="role-info-value">{{ usuario.rol }}</span>
          </div>
        </div>
      </section>

      <section class="password-form">
        <div class="role-field">
          <label for="nuevaPassword">Nueva contraseña</label>
          <input
            id="nuevaPassword"
            v-model="nuevaPassword"
            type="password"
            placeholder="Mínimo 6 caracteres"
            autocomplete="new-password"
          />
        </div>
        <div class="role-field">
          <label for="confirmarPassword">Confirmar contraseña</label>
          <input
            id="confirmarPassword"
            v-model="confirmarPassword"
            type="password"
            placeholder="Repite la contraseña"
            autocomplete="new-password"
          />
        </div>
      </section>

      <p v-if="mensaje" :class="['feedback', mensajeTipo]">{{ mensaje }}</p>

      <div class="actions">
        <button type="button" class="role-btn role-btn-secondary" @click="router.push('/director/usuarios')">
          Cancelar
        </button>
        <button
          type="button"
          class="role-btn role-btn-primary"
          :disabled="cambiando"
          @click="cambiarPasswordAdmin"
        >
          {{ cambiando ? 'Guardando...' : 'Cambiar contraseña' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.usuario-resumen {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border-light);
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.feedback {
  margin-top: 16px;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: var(--radius);
}

.feedback.ok {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.feedback.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.role-empty-inline {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}
</style>
