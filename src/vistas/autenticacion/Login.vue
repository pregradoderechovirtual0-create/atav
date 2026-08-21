<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { db, auth } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { applyThemeForRole } from '@/lib/nucleo/theme'
import { iniciarSesionConCedula, LoginError } from '@/lib/autenticacion/authLogin'
import { hashPassword } from '@/lib/autenticacion/passwordUtils'
import { rutaInicioPorRol } from '@/lib/nucleo/rutas'
import { sincronizarSesionLocal, consumirMotivoCierreSesion, mensajeMotivoCierreSesion } from '@/lib/autenticacion/session'
import AtavLogoMark from '@/componentes/marca/AtavLogoMark.vue'

const router = useRouter()

const modo = ref<'login' | 'registro'>('login')

const cambiarModo = (nuevo: 'login' | 'registro') => {
  if (modo.value === nuevo) return
  errorMessage.value = ''
  successMessage.value = ''
  modo.value = nuevo
}

const syncScrollLock = () => {
  const lock = window.innerWidth > 1024
  document.documentElement.style.overflow = lock ? 'hidden' : ''
  document.body.style.overflow = lock ? 'hidden' : ''
}

onMounted(() => {
  rememberMe.value = localStorage.getItem('atav-remember') === '1'
  const motivo = consumirMotivoCierreSesion()
  if (motivo) {
    errorMessage.value = mensajeMotivoCierreSesion(motivo)
  }
  syncScrollLock()
  window.addEventListener('resize', syncScrollLock)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncScrollLock)
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
})

const cedula = ref('')
const password = ref('')
const isLoadingLogin = ref(false)
const showLoginPassword = ref(false)
const rememberMe = ref(false)

const regCedula = ref('')
const regPassword = ref('')
const regConfirm = ref('')
const isLoadingReg = ref(false)
const showPassword = ref(false)
const showConfirm = ref(false)

const showResetModal = ref(false)
const correoSoporte = 'derechovirtual@usc.edu.co'

const errorMessage = ref('')
const successMessage = ref('')

const login = async () => {
  errorMessage.value = ''
  const cedulaLimpia = cedula.value.trim()

  if (!cedulaLimpia || !password.value) {
    errorMessage.value = 'Debes completar todos los campos'
    return
  }

  if (!/^\d+$/.test(cedulaLimpia)) {
    errorMessage.value = 'La cédula debe contener solo números'
    return
  }

  try {
    isLoadingLogin.value = true
    const data = await iniciarSesionConCedula(cedulaLimpia, password.value, rememberMe.value)
    localStorage.setItem('atav-remember', rememberMe.value ? '1' : '0')
    const rol = data.rol

    if (auth.currentUser) {
      sincronizarSesionLocal({
        cedula: cedulaLimpia,
        rol,
        uid: auth.currentUser.uid,
        nombre: (data.nombre || '').toString(),
      })
    }

    applyThemeForRole(rol)
    await router.replace(rutaInicioPorRol(rol))
  } catch (error) {
    if (error instanceof LoginError) {
      if (error.code === 'NOT_FOUND') {
        errorMessage.value = 'Usuario no encontrado'
      } else {
        errorMessage.value = error.message
      }
    } else {
      errorMessage.value = 'Cédula o contraseña incorrecta'
    }
  } finally {
    isLoadingLogin.value = false
  }
}

const registrar = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  const cedulaLimpia = regCedula.value.trim()

  if (!cedulaLimpia || !regPassword.value || !regConfirm.value) {
    errorMessage.value = 'Todos los campos son obligatorios'
    return
  }

  if (!/^\d+$/.test(cedulaLimpia)) {
    errorMessage.value = 'La cédula debe ser solo números'
    return
  }

  if (regPassword.value !== regConfirm.value) {
    errorMessage.value = 'Las contraseñas no coinciden'
    return
  }

  if (regPassword.value.length < 6) {
    errorMessage.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }

  try {
    isLoadingReg.value = true
    const userRef = doc(db, 'usuarios', cedulaLimpia)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      errorMessage.value = 'Esta cédula no está autorizada'
      return
    }

    const userData = userSnap.data()

    if (userData.passwordTemporal === true || userData.authDesincronizado === true) {
      errorMessage.value =
        'Administración ya te asignó una contraseña. Ve a "Iniciar sesión" e ingrésala allí (no uses Activar cuenta).'
      modo.value = 'login'
      cedula.value = cedulaLimpia
      return
    }

    if (userData.registrado === true) {
      errorMessage.value = 'Ya tienes contraseña. Inicia sesión.'
      return
    }

    await createUserWithEmailAndPassword(auth, `${cedulaLimpia}@atav.com`, regPassword.value)

    await updateDoc(userRef, {
      registrado: true,
      requiereCambioPassword: false,
      passwordTemporal: false,
      password_hash: await hashPassword(regPassword.value),
      auth_uid: auth.currentUser?.uid || null,
    })

    successMessage.value = 'Registro exitoso. Redirigiendo...'

    setTimeout(() => {
      modo.value = 'login'
      cedula.value = cedulaLimpia
      regCedula.value = ''
      regPassword.value = ''
      regConfirm.value = ''
      showPassword.value = false
      showConfirm.value = false
    }, 1500)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === 'auth/email-already-in-use') {
      errorMessage.value = 'Este usuario ya fue registrado'
    } else if (err.code === 'auth/weak-password') {
      errorMessage.value = 'Contraseña muy débil'
    } else {
      errorMessage.value = err.message || 'No se pudo completar el registro'
    }
  } finally {
    isLoadingReg.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-bg" aria-hidden="true">
      <div class="login-bg-base" />
      <svg class="login-waves" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(15, 23, 42, 0.06)" />
            <stop offset="50%" stop-color="rgba(15, 23, 42, 0.04)" />
            <stop offset="100%" stop-color="rgba(15, 23, 42, 0.06)" />
          </linearGradient>
          <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(15, 23, 42, 0.045)" />
            <stop offset="50%" stop-color="rgba(15, 23, 42, 0.025)" />
            <stop offset="100%" stop-color="rgba(15, 23, 42, 0.045)" />
          </linearGradient>
        </defs>
        <path
          class="wave-path wave-path--1"
          d="M0 520 C 180 480, 360 560, 540 530 C 720 500, 900 580, 1080 550 C 1260 520, 1380 540, 1440 530 L 1440 900 L 0 900 Z"
          fill="url(#waveGrad1)"
        />
        <path
          class="wave-path wave-path--2"
          d="M0 620 C 200 580, 400 680, 600 640 C 800 600, 1000 700, 1200 660 C 1320 640, 1380 650, 1440 640 L 1440 900 L 0 900 Z"
          fill="rgba(15, 23, 42, 0.035)"
        />
        <path
          class="wave-path wave-path--3"
          d="M0 700 C 240 660, 480 760, 720 720 C 960 680, 1200 780, 1440 740 L 1440 900 L 0 900 Z"
          fill="url(#waveGrad2)"
        />
        <path
          class="wave-path wave-path--4"
          d="M0 760 C 180 740, 360 800, 540 770 C 720 740, 900 810, 1080 780 C 1260 750, 1380 770, 1440 760 L 1440 900 L 0 900 Z"
          fill="rgba(15, 23, 42, 0.02)"
        />
      </svg>
    </div>

    <div class="login-layout">
    <aside class="login-hero">
      <div class="hero-inner">
        <div class="hero-content">
          <div class="hero-brand">
            <div class="hero-logo-box">
              <AtavLogoMark :size="36" color="#ffffff" />
            </div>
            <span class="hero-brand-name">atav</span>
          </div>

          <h1 class="hero-title">Aplicativos de Trámites Académicos Virtuales</h1>
          <div class="hero-line" />
          <p class="hero-desc">
            Plataforma creada para simplificar, organizar y gestionar tus procesos académicos.
          </p>
        </div>

        <div class="hero-footer">
          <p class="hero-footer-title">Derecho Virtual</p>
          <p class="hero-footer-sub">Universidad Santiago de Cali</p>
        </div>
      </div>
    </aside>

    <!-- Panel derecho: card -->
    <section class="login-stage">
      <div class="login-card-scene">
        <div class="login-card" :class="{ 'is-flipped': modo === 'registro' }">
          <div class="login-card-inner">
            <div class="card-face card-face--login">
            <header class="card-header">
              <h2 class="card-title">Bienvenido</h2>
              <p class="card-subtitle">Ingresa a tu cuenta para continuar</p>
              <div class="card-divider">
                <span class="card-divider-line" />
                <span class="card-divider-logo">
                  <AtavLogoMark :size="22" color="#0f172a" />
                </span>
                <span class="card-divider-line" />
              </div>
            </header>

            <form class="form" @submit.prevent="login">
              <div class="form-group">
                <label class="form-label">Cédula</label>
                <div class="input-wrap">
                  <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    v-model="cedula"
                    type="text"
                    class="form-input"
                    placeholder="Ingresa tu número de cédula"
                    autocomplete="username"
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Contraseña</label>
                <div class="input-wrap">
                  <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    v-model="password"
                    :type="showLoginPassword ? 'text' : 'password'"
                    class="form-input"
                    placeholder="Ingresa tu contraseña"
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="toggle-pass"
                    :aria-label="showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                    :aria-pressed="showLoginPassword"
                    @click="showLoginPassword = !showLoginPassword"
                  >
                    <svg
                      v-if="showLoginPassword"
                      class="toggle-pass-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    <svg
                      v-else
                      class="toggle-pass-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="form-row-meta">
                <label class="remember">
                  <input v-model="rememberMe" type="checkbox" />
                  <span>Recordarme</span>
                </label>
                <button type="button" class="link-btn" @click="showResetModal = true">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <p v-if="errorMessage && modo === 'login'" class="msg-error">{{ errorMessage }}</p>

              <button type="submit" class="btn-primary" :disabled="isLoadingLogin">
                <span>{{ isLoadingLogin ? 'Ingresando...' : 'Ingresar' }}</span>
                <svg v-if="!isLoadingLogin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
                <svg v-else class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </button>
            </form>

            <div class="card-alt-row">
              <span class="card-alt-text">¿Primera vez?</span>
              <button type="button" class="link-btn" @click="cambiarModo('registro')">
                Activa tu cuenta
              </button>
            </div>
            </div>

            <div class="card-face card-face--registro">
            <header class="card-header">
              <h2 class="card-title">Activa tu cuenta</h2>
              <p class="card-subtitle">Crea tu contraseña para el primer ingreso</p>
              <div class="card-divider">
                <span class="card-divider-line" />
                <span class="card-divider-logo">
                  <AtavLogoMark :size="22" color="#0f172a" />
                </span>
                <span class="card-divider-line" />
              </div>
            </header>

            <form class="form" @submit.prevent="registrar">
              <div class="form-group">
                <label class="form-label">Cédula</label>
                <div class="input-wrap">
                  <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input v-model="regCedula" type="text" class="form-input" placeholder="Ingresa tu número de cédula" autocomplete="username" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Nueva contraseña</label>
                <div class="input-wrap">
                  <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    v-model="regPassword"
                    :type="showPassword ? 'text' : 'password'"
                    class="form-input"
                    placeholder="Mínimo 6 caracteres"
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    class="toggle-pass"
                    :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                    :aria-pressed="showPassword"
                    @click="showPassword = !showPassword"
                  >
                    <svg
                      v-if="showPassword"
                      class="toggle-pass-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    <svg
                      v-else
                      class="toggle-pass-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Confirmar contraseña</label>
                <div class="input-wrap">
                  <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    v-model="regConfirm"
                    :type="showConfirm ? 'text' : 'password'"
                    class="form-input"
                    placeholder="Repite tu contraseña"
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    class="toggle-pass"
                    :aria-label="showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                    :aria-pressed="showConfirm"
                    @click="showConfirm = !showConfirm"
                  >
                    <svg
                      v-if="showConfirm"
                      class="toggle-pass-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    <svg
                      v-else
                      class="toggle-pass-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <p v-if="errorMessage && modo === 'registro'" class="msg-error">{{ errorMessage }}</p>
              <p v-if="successMessage" class="msg-success">{{ successMessage }}</p>

              <button type="submit" class="btn-primary" :disabled="isLoadingReg">
                <span>{{ isLoadingReg ? 'Activando...' : 'Activar cuenta' }}</span>
                <svg v-if="!isLoadingReg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </form>

            <div class="card-alt-row">
              <span class="card-alt-text">¿Ya tienes cuenta?</span>
              <button type="button" class="link-btn" @click="cambiarModo('login')">
                Iniciar sesión
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div class="trust-badges trust-badges--desktop">
        <div class="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Seguro
        </div>
        <div class="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Confiable
        </div>
        <div class="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          Académico
        </div>
      </div>

      <div class="stage-footer stage-footer--mobile">
        <p class="stage-footer-title">Derecho Virtual</p>
        <p class="stage-footer-sub">Universidad Santiago de Cali</p>
      </div>
    </section>
    </div>

    <!-- Modal restablecimiento -->
    <div v-if="showResetModal" class="modal-overlay" @click.self="showResetModal = false">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <button type="button" class="modal-close" aria-label="Cerrar" @click="showResetModal = false">×</button>
        <div class="modal-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 id="reset-title">Solicitar restablecimiento</h2>
        <p>
          Para solicitar el restablecimiento de tu contraseña, envía un correo desde
          tu correo institucional con la siguiente información:
        </p>
        <div class="instructions">
          <p><strong>Para:</strong> {{ correoSoporte }}</p>
          <p><strong>Asunto:</strong> Solicitud de restablecimiento de contraseña ATAV</p>
          <p><strong>Contenido del correo:</strong></p>
          <ul>
            <li>Nombre completo</li>
            <li>Número de cédula</li>
            <li>Número celular</li>
            <li>Solicitud de restablecimiento de contraseña</li>
          </ul>
        </div>
        <p class="modal-note">
          Una vez validada la solicitud, administración te asignará una contraseña temporal.
        </p>
        <button type="button" class="btn-primary" @click="showResetModal = false">Entendido</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background: #f4f6f8;
}

.login-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.login-bg-base {
  position: absolute;
  inset: 0;
  background: linear-gradient(165deg, #fafbfc 0%, #f4f6f8 45%, #eef1f5 100%);
}

.login-waves {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 70%;
  min-height: 400px;
}

.wave-path--1 {
  animation: wave-drift 18s ease-in-out infinite;
}

.wave-path--2 {
  animation: wave-drift 22s ease-in-out infinite reverse;
}

.wave-path--3 {
  animation: wave-drift 26s ease-in-out infinite;
}

.wave-path--4 {
  animation: wave-drift 30s ease-in-out infinite reverse;
}

@keyframes wave-drift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-2%); }
}

.login-layout {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

/* ── Hero izquierdo ── */
.login-hero {
  flex: 1.05;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 48px 56px 48px 64px;
}

.hero-inner {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 48px;
  min-height: 0;
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
}

.hero-logo-box {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-brand-name {
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  font-size: 36px;
  color: #0f172a;
  letter-spacing: -0.03em;
  text-transform: lowercase;
  line-height: 1;
}

.hero-title {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(30px, 3vw, 40px);
  font-weight: 600;
  color: #0f172a;
  line-height: 1.18;
  letter-spacing: -0.03em;
  max-width: 440px;
}

.hero-line {
  width: 52px;
  height: 3px;
  background: #0f172a;
  border-radius: 2px;
  margin: 22px 0 18px;
}

.hero-desc {
  font-size: 15px;
  line-height: 1.65;
  color: #64748b;
  max-width: 400px;
}

.hero-footer {
  padding-top: 8px;
}

.hero-footer-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.hero-footer-sub {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

/* ── Stage derecho ── */
.login-stage {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 48px;
  overflow: hidden;
}

.login-card-scene {
  perspective: 1200px;
  width: 100%;
  max-width: 420px;
  flex-shrink: 0;
}

.login-card {
  width: 100%;
}

.login-card-inner {
  position: relative;
  width: 100%;
  height: 500px;
  transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform-style: preserve-3d;
  transform-origin: center center;
}

.login-card.is-flipped .login-card-inner {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
  border-radius: 24px;
  padding: 28px 26px 24px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px rgba(15, 23, 42, 0.06),
    0 24px 56px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.07);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-face--login {
  transform: rotateY(0deg);
  z-index: 2;
}

.card-face--registro {
  transform: rotateY(180deg);
  z-index: 1;
}

.card-header {
  text-align: center;
  margin-bottom: 18px;
  flex-shrink: 0;
}

.card-title {
  font-family: 'Poppins', sans-serif;
  font-size: 26px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}

.card-subtitle {
  font-size: 14px;
  color: #64748b;
  line-height: 1.45;
}

.card-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.card-divider-line {
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.card-divider-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.trust-badges--desktop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  margin-top: 28px;
  flex-wrap: wrap;
}

.trust-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
}

.trust-item svg {
  opacity: 0.75;
  flex-shrink: 0;
}

.stage-footer--mobile {
  display: none;
  text-align: center;
  margin-top: 20px;
}

.stage-footer-title {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.stage-footer-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 3px;
}

/* ── Formulario ── */
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #0f172a;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #94a3b8;
  pointer-events: none;
  z-index: 1;
}

.form-input {
  width: 100%;
  height: 44px;
  padding: 0 48px 0 42px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  background: #fafafa;
  color: #0f172a;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #0f172a;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.06);
}

.form-input::placeholder {
  color: #94a3b8;
}

.toggle-pass {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  z-index: 2;
  flex-shrink: 0;
}

.toggle-pass-icon {
  display: block;
  flex-shrink: 0;
  pointer-events: none;
}

.toggle-pass:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.toggle-pass:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.12);
}

.form-row-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
}

.remember input {
  width: 16px;
  height: 16px;
  accent-color: #0f172a;
}

.link-btn {
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 500;
  color: #0f172a;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.msg-error {
  font-size: 13px;
  color: #dc2626;
  margin: 0;
}

.msg-success {
  font-size: 13px;
  color: #16a34a;
  margin: 0;
}

.btn-primary {
  height: 46px;
  width: 100%;
  border: none;
  border-radius: 10px;
  background: #0f172a;
  color: white;
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  background: #1e293b;
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.card-alt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 2px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.card-alt-text {
  font-size: 13px;
  color: #64748b;
}

.card-separator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 22px 0 16px;
}

.card-separator-line {
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.card-separator-text {
  font-size: 13px;
  color: #94a3b8;
  white-space: nowrap;
}

.spinner {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 460px;
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.2);
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 14px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #94a3b8;
  font-size: 24px;
  cursor: pointer;
}

.modal-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.modal-icon {
  width: 52px;
  height: 52px;
  background: #f1f5f9;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0f172a;
  margin-bottom: 16px;
}

.modal-card h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #0f172a;
}

.modal-card p {
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}

.instructions {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px;
  margin: 16px 0;
}

.instructions p,
.instructions li {
  font-size: 13px;
  color: #0f172a;
}

.instructions ul {
  padding-left: 20px;
  margin: 8px 0 0;
}

.modal-note {
  margin-bottom: 18px !important;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .login-page {
    height: auto;
    min-height: 100vh;
    max-height: none;
    overflow-x: hidden;
    overflow-y: auto;
    background: #ffffff;
  }

  .login-bg {
    display: none;
  }

  .login-layout {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
    max-height: none;
    overflow: visible;
  }

  .login-hero {
    display: flex;
    flex: none;
    padding: 28px 28px 12px;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .hero-inner {
    min-height: auto;
    gap: 0;
    max-width: none;
    width: 100%;
  }

  .hero-content {
    width: 100%;
    display: block;
  }

  .hero-brand {
    justify-content: flex-start;
    margin-bottom: 0;
  }

  .hero-title,
  .hero-line,
  .hero-desc {
    display: none;
  }

  .hero-footer {
    display: none;
  }

  .login-stage {
    flex: 1;
    width: 100%;
    padding: 8px 28px 0;
    justify-content: flex-start;
    overflow: visible;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .login-card-scene {
    max-width: none;
    perspective: none;
  }

  .login-card-inner {
    height: auto;
    transform-style: flat;
    transition: none;
  }

  .login-card.is-flipped .login-card-inner {
    transform: none;
  }

  .card-face {
    position: relative;
    height: auto;
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
    overflow: visible;
    display: block;
    backface-visibility: visible;
    -webkit-backface-visibility: visible;
    transform: none;
  }

  .card-face--login {
    display: block;
  }

  .card-face--registro {
    display: none;
    transform: none;
  }

  .login-card.is-flipped .card-face--login {
    display: none;
  }

  .login-card.is-flipped .card-face--registro {
    display: block;
  }

  .card-header {
    text-align: left;
    margin-bottom: 22px;
  }

  .card-divider {
    margin-top: 16px;
  }

  .trust-badges--desktop {
    display: none;
  }

  .stage-footer--mobile {
    display: block;
    margin-top: auto;
    padding: 20px 0 24px;
    text-align: center;
    border-top: none;
  }

  .card-alt-row {
    border-top-color: #f1f5f9;
    padding-top: 16px;
  }
}

@media (max-width: 480px) {
  .login-hero {
    padding: 24px 20px 8px;
  }

  .login-stage {
    padding: 4px 20px 0;
  }

  .stage-footer--mobile {
    padding-bottom: 20px;
  }

  .hero-brand-name {
    font-size: 28px;
  }

  .card-title {
    font-size: 22px;
  }
}
</style>
