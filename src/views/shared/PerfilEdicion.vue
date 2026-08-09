<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db, auth } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const router = useRouter()

const usuario = ref<any>(null)
const cargando = ref(true)
const guardando = ref(false)
const mensaje = ref('')
const error = ref('')

const formData = ref({
  nombre: '',
  apellido: '',
  correo: '',
})

const cargarDatos = async (user: any) => {
  try {
    const cedula = localStorage.getItem('cedula')

    if (!cedula) {
      cargando.value = false
      return
    }

    const refDoc = doc(db, "usuarios", cedula)
    const snap = await getDoc(refDoc)

    if (snap.exists()) {
      usuario.value = snap.data()
      formData.value = {
        nombre: usuario.value.nombre || '',
        apellido: usuario.value.apellido || '',
        correo: usuario.value.correo || '',
      }
    }
  } catch (err) {
    console.error(err)
    error.value = 'Error al cargar los datos'
  } finally {
    cargando.value = false
  }
}

const guardarCambios = async () => {
  error.value = ''
  mensaje.value = ''

  // Validaciones
  if (!formData.value.nombre.trim()) {
    error.value = 'El nombre es requerido'
    return
  }

  if (!formData.value.apellido.trim()) {
    error.value = 'El apellido es requerido'
    return
  }

  if (!formData.value.correo.trim()) {
    error.value = 'El correo es requerido'
    return
  }

  // Validar formato de correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(formData.value.correo)) {
    error.value = 'Ingresa un correo válido'
    return
  }

  guardando.value = true

  try {
    const cedula = localStorage.getItem('cedula')

    if (!cedula) {
      error.value = 'No se encontró la cédula del usuario'
      return
    }

    const refDoc = doc(db, "usuarios", cedula)

    await updateDoc(refDoc, {
      nombre: formData.value.nombre,
      apellido: formData.value.apellido,
      correo: formData.value.correo,
    })

    mensaje.value = 'Perfil actualizado correctamente'
    setTimeout(() => {
      router.push('/perfil')
    }, 1500)
  } catch (err) {
    console.error(err)
    error.value = 'Error al guardar los cambios'
  } finally {
    guardando.value = false
  }
}

const cancelar = () => {
  router.push('/perfil')
}

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      router.push('/login')
      return
    }

    await cargarDatos(user)
  })
})
</script>

<template>
  <div class="perfil-edicion">
    <div class="contenedor">
      <!-- Header -->
      <div class="header">
        <h1 class="titulo">Editar Perfil</h1>
      </div>

      <!-- Contenido -->
      <div v-if="cargando" class="cargando">
        <p>Cargando información...</p>
      </div>

      <div v-else class="formulario-contenedor">
        <!-- Formulario -->
        <form @submit.prevent="guardarCambios" class="formulario">
          <div class="form-group">
            <label for="nombre" class="form-label">Nombre *</label>
            <input
              id="nombre"
              v-model="formData.nombre"
              type="text"
              class="form-input"
              placeholder="Ingresa tu nombre"
            />
          </div>

          <div class="form-group">
            <label for="apellido" class="form-label">Apellido *</label>
            <input
              id="apellido"
              v-model="formData.apellido"
              type="text"
              class="form-input"
              placeholder="Ingresa tu apellido"
            />
          </div>

          <div class="form-group">
            <label for="correo" class="form-label">Correo electrónico *</label>
            <input
              id="correo"
              v-model="formData.correo"
              type="email"
              class="form-input"
              placeholder="Ingresa tu correo"
            />
          </div>

          

          <!-- Mensajes -->
          <div v-if="error" class="alert alert-error">
            {{ error }}
          </div>

          <div v-if="mensaje" class="alert alert-success">
            {{ mensaje }}
          </div>

          <!-- Botones -->
          <div class="form-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="cancelar"
              :disabled="guardando"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="guardando"
            >
              {{ guardando ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.perfil-edicion {
  min-height: 100vh;
  padding: 24px;
  background: var(--color-background);
}

.contenedor {
  max-height: 100%;
  margin: 0 auto;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 20px;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-back:hover {
  color: var(--color-primary-dark);
  transform: translateX(-4px);
}

.titulo {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
}

/* Cargando */
.cargando {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--color-text-secondary);
}

/* Contenedor Formulario */
.formulario-contenedor {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 32px;
}

/* Formulario */
.formulario {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.form-input {
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text);
  background: var(--color-background);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled {
  background: var(--color-background);
  cursor: not-allowed;
  opacity: 0.5;
}

/* Alertas */
.alert {
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #dc2626;
}

.alert-success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #16a34a;
}

/* Acciones */
.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-secondary {
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-border);
  border-color: var(--color-text);
}

/* Responsive */
@media (max-width: 768px) {
  .perfil-edicion {
    padding: 16px;
  }

  .formulario-contenedor {
    padding: 24px;
  }

  .titulo {
    font-size: 24px;
    
  }

  .form-actions {
    flex-direction: column-reverse;
  }
}
</style>
