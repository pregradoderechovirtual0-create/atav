<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { dialog } from '@/lib/nucleo/dialog'
import { reactivarCuentaUsuario, ReactivarCuentaError } from '@/lib/autenticacion/reactivarCuenta'

const route = useRoute()
const router = useRouter()

const cedulaParam = route.params.cedula
const cedula = Array.isArray(cedulaParam) ? cedulaParam[0] : (cedulaParam as string)

const usuario = ref<Record<string, string> | null>(null)
const loading = ref(true)
const reactivando = ref(false)
const mensaje = ref('')
const mensajeTipo = ref<'ok' | 'error' | ''>('')

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

const confirmarReactivacion = async () => {
  mensaje.value = ''
  mensajeTipo.value = ''

  if (!usuario.value) {
    mensaje.value = 'No hay usuario cargado'
    mensajeTipo.value = 'error'
    return
  }

  const nombre = [usuario.value.nombre, usuario.value.apellido].filter(Boolean).join(' ')
  const ok = await dialog.confirm(
    `Se restablecerá solo el acceso de ${nombre || 'este usuario'}. Sus datos (nombre, rol, historial) se conservan. Deberá ir a «Activa tu cuenta» en el login y crear una contraseña nueva.`,
    {
      title: 'Reactivar cuenta',
      confirmText: 'Reactivar',
      variant: 'danger',
    },
  )
  if (!ok) return

  try {
    reactivando.value = true
    await reactivarCuentaUsuario(cedula)

    mensaje.value =
      'Cuenta reactivada. Indica al usuario que entre al portal, pulse «Activa tu cuenta» e ingrese su cédula para crear una contraseña nueva.'
    mensajeTipo.value = 'ok'
    setTimeout(() => router.push('/director/usuarios'), 2200)
  } catch (error) {
    console.error(error)
    if (error instanceof ReactivarCuentaError) {
      mensaje.value = error.message
    } else {
      mensaje.value = error instanceof Error ? error.message : 'No se pudo reactivar la cuenta.'
    }
    mensajeTipo.value = 'error'
  } finally {
    reactivando.value = false
  }
}
</script>

<template>
  <div class="role-page">
    <div v-if="loading" class="role-empty">Cargando usuario...</div>

    <div v-else-if="!usuario" class="role-empty">
      <p>Usuario no encontrado.</p>
      <router-link to="/director/usuarios" class="btn btn-secondary">Volver a usuarios</router-link>
    </div>

    <div v-else class="reactivar-card">
      <header class="reactivar-header">
        <router-link to="/director/usuarios" class="back-link">← Usuarios</router-link>
        <h1>Reactivar cuenta</h1>
        <p class="reactivar-sub">
          Solo se resetea la contraseña. El perfil y los datos del usuario no se eliminan.
        </p>
      </header>

      <div class="usuario-resumen">
        <p><strong>Nombre:</strong> {{ usuario.nombre }} {{ usuario.apellido || '' }}</p>
        <p><strong>Cédula:</strong> {{ usuario.id }}</p>
        <p><strong>Rol:</strong> {{ usuario.rol }}</p>
        <p v-if="usuario.correo"><strong>Correo:</strong> {{ usuario.correo }}</p>
      </div>

      <div class="reactivar-info" role="note">
        <p>El usuario verá el flujo de <strong>«Activa tu cuenta»</strong> igual que en su primer ingreso.</p>
      </div>

      <p v-if="mensaje" :class="['reactivar-msg', mensajeTipo === 'ok' ? 'reactivar-msg--ok' : 'reactivar-msg--error']">
        {{ mensaje }}
      </p>

      <div class="reactivar-actions">
        <router-link to="/director/usuarios" class="reactivar-btn reactivar-btn--ghost">
          Cancelar
        </router-link>
        <button
          type="button"
          class="reactivar-btn reactivar-btn--primary"
          :disabled="reactivando"
          @click="confirmarReactivacion"
        >
          <svg v-if="!reactivando" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          <svg v-else class="reactivar-btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          {{ reactivando ? 'Reactivando...' : 'Reactivar cuenta' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reactivar-card {
  max-width: 520px;
  margin: 0 auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 28px;
}

.reactivar-header h1 {
  font-size: 22px;
  margin: 12px 0 6px;
}

.reactivar-sub {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.back-link {
  font-size: 13px;
  color: var(--color-primary);
  text-decoration: none;
}

.usuario-resumen {
  margin: 20px 0;
  padding: 16px;
  background: var(--color-background);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
}

.usuario-resumen p { margin: 0 0 4px; }

.reactivar-info {
  padding: 12px 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  font-size: 13px;
  color: #1e40af;
  margin-bottom: 16px;
}

.reactivar-msg {
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.reactivar-msg--ok {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.reactivar-msg--error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.reactivar-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
}

.reactivar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
}

.reactivar-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.reactivar-btn--ghost {
  background: var(--color-surface, #fff);
  color: var(--color-text, #0f172a);
  border: 1px solid var(--color-border, #e5e7eb);
}

.reactivar-btn--ghost:hover {
  background: var(--color-subtle, #f8fafc);
  border-color: var(--color-text-muted, #94a3b8);
}

.reactivar-btn--primary {
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
}

.reactivar-btn--primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #1e293b 0%, #334155 100%);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22);
}

.reactivar-btn--primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  box-shadow: none;
}

.reactivar-btn-spinner {
  animation: reactivar-spin 0.9s linear infinite;
}

@keyframes reactivar-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .reactivar-actions {
    flex-direction: column-reverse;
  }
}
</style>
