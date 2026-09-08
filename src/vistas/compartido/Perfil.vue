<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { db, auth } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { obtenerSesion } from '@/lib/autenticacion/session'
import {
  cargarContactoPerfil,
  guardarCelularPerfil,
  asuntoSoporteSugerido,
  type PerfilContacto,
} from '@/lib/dominio/perfilContacto'

const usuario = ref<Record<string, any> | null>(null)
const contacto = ref<PerfilContacto>({ celular: '', correoInstitucional: '' })
const cedula = ref('')
const rol = ref('')
const cargando = ref(true)

const celularInput = ref('')
const guardandoCelular = ref(false)
const mensajeCelular = ref('')
const errorCelular = ref('')

const mostrarPasswordForm = ref(false)
const passwordActual = ref('')
const passwordNueva = ref('')
const passwordConfirm = ref('')
const showActual = ref(false)
const showNueva = ref(false)
const mensajePassword = ref('')
const errorPassword = ref('')
const guardandoPassword = ref(false)

const modalSoporte = ref(false)

const nombreCompleto = computed(() => {
  const u = usuario.value
  if (!u) return ''
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || u.nombre || ''
})

const iniciales = computed(() => {
  const parts = nombreCompleto.value.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('')
})

const correoMostrar = computed(() =>
  contacto.value.correoInstitucional || usuario.value?.correo || '—',
)

const asuntoSoporte = computed(() =>
  asuntoSoporteSugerido(nombreCompleto.value, cedula.value, rol.value),
)

const mailtoSoporte = computed(() => {
  const body = [
    'Hola equipo de Derecho Virtual,',
    '',
    'Descripción del problema:',
    '',
    '[Describe aquí tu situación o consulta]',
    '',
    `Nombre: ${nombreCompleto.value}`,
    `Cédula: ${cedula.value}`,
    `Correo: ${correoMostrar.value}`,
  ].join('\n')
  const params = new URLSearchParams({
    subject: asuntoSoporte.value,
    body,
  })
  return `mailto:derechovirtual@usc.edu.co?${params.toString()}`
})

const cargarPerfil = async () => {
  if (!cedula.value) return
  try {
    const snap = await getDoc(doc(db, 'usuarios', cedula.value))
    if (snap.exists()) {
      usuario.value = snap.data()
    }
    contacto.value = await cargarContactoPerfil(cedula.value)
    celularInput.value = contacto.value.celular
  } catch (error) {
    console.error('Error cargando perfil:', error)
    contacto.value = {
      celular: '',
      correoInstitucional: cedula.value ? `${cedula.value}@usc.edu.co` : '',
    }
  }
}

const guardarCelular = async () => {
  errorCelular.value = ''
  mensajeCelular.value = ''
  guardandoCelular.value = true
  try {
    await guardarCelularPerfil(cedula.value, celularInput.value)
    contacto.value = await cargarContactoPerfil(cedula.value)
    mensajeCelular.value = 'Celular guardado. Se usará en tus formularios cuando lo selecciones.'
  } catch (e) {
    errorCelular.value = e instanceof Error ? e.message : 'No se pudo guardar el celular'
  } finally {
    guardandoCelular.value = false
  }
}

const cambiarPassword = async () => {
  errorPassword.value = ''
  mensajePassword.value = ''

  if (!passwordActual.value || !passwordNueva.value || !passwordConfirm.value) {
    errorPassword.value = 'Completa todos los campos'
    return
  }
  if (passwordNueva.value.length < 6) {
    errorPassword.value = 'La nueva contraseña debe tener mínimo 6 caracteres'
    return
  }
  if (passwordNueva.value !== passwordConfirm.value) {
    errorPassword.value = 'Las contraseñas no coinciden'
    return
  }

  guardandoPassword.value = true
  try {
    const user = auth.currentUser
    if (!user?.email) {
      errorPassword.value = 'No hay usuario autenticado'
      return
    }
    const credential = EmailAuthProvider.credential(user.email, passwordActual.value)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, passwordNueva.value)
    mensajePassword.value = 'Contraseña actualizada correctamente'
    passwordActual.value = ''
    passwordNueva.value = ''
    passwordConfirm.value = ''
    mostrarPasswordForm.value = false
  } catch {
    errorPassword.value = 'La contraseña actual es incorrecta o la sesión expiró'
  } finally {
    guardandoPassword.value = false
  }
}

const copiarAsunto = async () => {
  try {
    await navigator.clipboard.writeText(asuntoSoporte.value)
  } catch {
    // ignore
  }
}

onMounted(async () => {
  const sesion = await obtenerSesion()
  if (sesion) {
    cedula.value = sesion.cedula
    rol.value = sesion.rol
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cargando.value = false
      return
    }
    try {
      await cargarPerfil()
    } catch (error) {
      console.error('Error cargando perfil:', error)
    } finally {
      cargando.value = false
    }
  })
})
</script>

<template>
  <div class="perfil-page">
    <div v-if="cargando" class="perfil-loading">Cargando perfil...</div>

    <template v-else>
      <section class="perfil-hero">
        <div class="perfil-avatar">{{ iniciales }}</div>
        <div class="perfil-hero-text">
          <h1 class="perfil-nombre">{{ nombreCompleto || 'Mi perfil' }}</h1>
          <p class="perfil-meta">{{ rol }} · CC {{ cedula }}</p>
        </div>
      </section>

      <div class="perfil-grid">
        <section class="perfil-card">
          <header class="perfil-card-header">
            <div class="perfil-card-icon perfil-card-icon--info">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <h2>Información de contacto</h2>
              <p>Tu celular se puede reutilizar al llenar formularios.</p>
            </div>
          </header>

          <div class="perfil-card-body">
            <div class="perfil-readonly-grid">
              <div class="perfil-field">
                <span class="perfil-label">Nombre</span>
                <span class="perfil-value">{{ nombreCompleto || '—' }}</span>
              </div>
              <div class="perfil-field">
                <span class="perfil-label">Correo institucional</span>
                <span class="perfil-value">{{ correoMostrar }}</span>
              </div>
              <div class="perfil-field">
                <span class="perfil-label">Cédula</span>
                <span class="perfil-value">{{ cedula }}</span>
              </div>
            </div>

            <div class="perfil-edit-block">
              <label class="perfil-label" for="perfil-celular">Celular</label>
              <div class="perfil-input-row">
                <input
                  id="perfil-celular"
                  v-model="celularInput"
                  type="tel"
                  class="perfil-input"
                  placeholder="Ej. 3001234567"
                  maxlength="15"
                />
                <button
                  type="button"
                  class="perfil-btn perfil-btn-primary"
                  :disabled="guardandoCelular || !celularInput.trim()"
                  @click="guardarCelular"
                >
                  {{ guardandoCelular ? 'Guardando...' : 'Guardar celular' }}
                </button>
              </div>
              <p v-if="mensajeCelular" class="perfil-msg perfil-msg--ok">{{ mensajeCelular }}</p>
              <p v-if="errorCelular" class="perfil-msg perfil-msg--error">{{ errorCelular }}</p>
              <p class="perfil-hint">En solicitudes podrás elegir si usas este número o escribes otro.</p>
            </div>
          </div>
        </section>

        <section class="perfil-card">
          <header class="perfil-card-header">
            <div class="perfil-card-icon perfil-card-icon--lock">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <h2>Seguridad</h2>
              <p>Actualiza tu contraseña de acceso.</p>
            </div>
          </header>

          <div class="perfil-card-body">
            <button
              type="button"
              class="perfil-btn perfil-btn-secondary"
              @click="mostrarPasswordForm = !mostrarPasswordForm"
            >
              {{ mostrarPasswordForm ? 'Ocultar formulario' : 'Cambiar contraseña' }}
            </button>

            <div v-if="mostrarPasswordForm" class="perfil-password-form">
              <div class="perfil-field-block">
                <label class="perfil-label" for="pwd-actual">Contraseña actual</label>
                <div class="perfil-password-wrap">
                  <input
                    id="pwd-actual"
                    v-model="passwordActual"
                    :type="showActual ? 'text' : 'password'"
                    class="perfil-input"
                    placeholder="Tu contraseña actual"
                  />
                  <button type="button" class="perfil-eye" @click="showActual = !showActual">
                    {{ showActual ? 'Ocultar' : 'Ver' }}
                  </button>
                </div>
              </div>
              <div class="perfil-field-block">
                <label class="perfil-label" for="pwd-nueva">Nueva contraseña</label>
                <div class="perfil-password-wrap">
                  <input
                    id="pwd-nueva"
                    v-model="passwordNueva"
                    :type="showNueva ? 'text' : 'password'"
                    class="perfil-input"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button type="button" class="perfil-eye" @click="showNueva = !showNueva">
                    {{ showNueva ? 'Ocultar' : 'Ver' }}
                  </button>
                </div>
              </div>
              <div class="perfil-field-block">
                <label class="perfil-label" for="pwd-confirm">Confirmar contraseña</label>
                <input
                  id="pwd-confirm"
                  v-model="passwordConfirm"
                  type="password"
                  class="perfil-input"
                  placeholder="Repite la nueva contraseña"
                />
              </div>
              <button
                type="button"
                class="perfil-btn perfil-btn-primary"
                :disabled="guardandoPassword"
                @click="cambiarPassword"
              >
                {{ guardandoPassword ? 'Guardando...' : 'Actualizar contraseña' }}
              </button>
              <p v-if="mensajePassword" class="perfil-msg perfil-msg--ok">{{ mensajePassword }}</p>
              <p v-if="errorPassword" class="perfil-msg perfil-msg--error">{{ errorPassword }}</p>
            </div>
          </div>
        </section>

        <section class="perfil-card perfil-card--help">
          <div class="perfil-help-content">
            <div class="perfil-card-icon perfil-card-icon--help">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h2>¿Necesitas ayuda?</h2>
              <p>Contacta al equipo de soporte académico si tienes dudas con la plataforma.</p>
              <button type="button" class="perfil-btn perfil-btn-light" @click="modalSoporte = true">
                Contactar soporte
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>

    <Teleport to="body">
      <Transition name="perfil-modal">
        <div v-if="modalSoporte" class="perfil-modal-overlay" @click.self="modalSoporte = false">
          <div class="perfil-modal" role="dialog" aria-labelledby="soporte-title">
            <header class="perfil-modal-header">
              <h2 id="soporte-title">Contactar soporte</h2>
              <button type="button" class="perfil-modal-close" @click="modalSoporte = false" aria-label="Cerrar">✕</button>
            </header>
            <div class="perfil-modal-body">
              <p>
                Envía un correo a
                <a href="mailto:derechovirtual@usc.edu.co" class="perfil-link">derechovirtual@usc.edu.co</a>
                describiendo tu problema o consulta con el mayor detalle posible.
              </p>
              <div class="perfil-asunto-box">
                <span class="perfil-label">Asunto sugerido</span>
                <div class="perfil-asunto-row">
                  <code class="perfil-asunto-text">{{ asuntoSoporte }}</code>
                  <button type="button" class="perfil-btn perfil-btn-secondary perfil-btn-sm" @click="copiarAsunto">
                    Copiar
                  </button>
                </div>
              </div>
              <ul class="perfil-soporte-list">
                <li>Incluye tu nombre y cédula si el asunto no los muestra.</li>
                <li>Describe qué estabas haciendo y qué error o situación ocurrió.</li>
                <li>Si aplica, indica la pantalla o trámite (flexibilización, supletorio, etc.).</li>
              </ul>
            </div>
            <footer class="perfil-modal-footer">
              <button type="button" class="perfil-btn perfil-btn-secondary" @click="modalSoporte = false">
                Cerrar
              </button>
              <a :href="mailtoSoporte" class="perfil-btn perfil-btn-primary perfil-btn-link">
                Abrir correo
              </a>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.perfil-page {
  max-width: 880px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.perfil-loading {
  padding: 48px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 14px;
}

.perfil-hero {
  display: flex;
  align-items: center;
  gap: 20px;
}

.perfil-avatar {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: linear-gradient(135deg, #0f172a, #334155);
  color: white;
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.perfil-nombre {
  font-size: clamp(24px, 4vw, 32px);
  font-weight: 700;
  color: #000;
  line-height: 1.2;
}

.perfil-meta {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.perfil-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.perfil-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}

.perfil-card-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px 22px;
  border-bottom: 1px solid var(--color-border-light);
}

.perfil-card-header h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.perfil-card-header p {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.perfil-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.perfil-card-icon--info { background: #eff6ff; color: #3b82f6; }
.perfil-card-icon--lock { background: #fef2f2; color: #ef4444; }
.perfil-card-icon--help { background: rgba(255,255,255,0.2); color: white; }

.perfil-card-body {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.perfil-readonly-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.perfil-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.perfil-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-text-muted);
}

.perfil-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.perfil-edit-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-light);
}

.perfil-input-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.perfil-input {
  flex: 1;
  min-width: 200px;
  padding: 11px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-surface);
}

.perfil-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.perfil-password-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-light);
}

.perfil-field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.perfil-password-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
}

.perfil-eye {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-accent);
  padding: 8px 10px;
  border-radius: var(--radius);
  background: var(--color-info-bg);
}

.perfil-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.perfil-msg {
  font-size: 13px;
}
.perfil-msg--ok { color: var(--color-success); }
.perfil-msg--error { color: var(--color-error); }

.perfil-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all var(--transition);
  text-decoration: none;
}

.perfil-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.perfil-btn-primary {
  background: var(--color-primary);
  color: white;
}
.perfil-btn-primary:hover:not(:disabled) { background: var(--color-primary-light); }

.perfil-btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.perfil-btn-secondary:hover:not(:disabled) { background: var(--color-subtle); }

.perfil-btn-light {
  background: white;
  color: var(--color-primary);
  margin-top: 12px;
}
.perfil-btn-light:hover { background: #f8fafc; }

.perfil-btn-sm { padding: 8px 12px; font-size: 12px; }
.perfil-btn-link { text-decoration: none; }

.perfil-card--help {
  background: linear-gradient(135deg, #0f172a, #1e293b);
  border: none;
  color: white;
}

.perfil-help-content {
  display: flex;
  gap: 16px;
  padding: 22px;
  align-items: flex-start;
}

.perfil-help-content h2 {
  font-size: 16px;
  font-weight: 600;
}

.perfil-help-content p {
  font-size: 13px;
  opacity: 0.9;
  margin-top: 4px;
  line-height: 1.45;
}

.perfil-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 3000;
}

.perfil-modal {
  width: min(520px, 100%);
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.perfil-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-border-light);
}

.perfil-modal-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.perfil-modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-subtle);
  color: var(--color-text-muted);
  font-size: 14px;
}

.perfil-modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.perfil-link {
  color: var(--color-accent);
  font-weight: 600;
}

.perfil-asunto-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--color-subtle);
  border-radius: var(--radius);
  border: 1px solid var(--color-border-light);
}

.perfil-asunto-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.perfil-asunto-text {
  flex: 1;
  font-size: 12px;
  color: var(--color-text);
  word-break: break-word;
  line-height: 1.4;
}

.perfil-soporte-list {
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.perfil-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-subtle);
}

.perfil-modal-enter-active,
.perfil-modal-leave-active {
  transition: opacity 0.2s ease;
}
.perfil-modal-enter-from,
.perfil-modal-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .perfil-readonly-grid { grid-template-columns: 1fr; }
  .perfil-input-row { flex-direction: column; }
  .perfil-input { min-width: 0; width: 100%; }
}
</style>
