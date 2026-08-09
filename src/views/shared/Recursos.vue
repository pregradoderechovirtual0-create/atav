<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, orderBy, query, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { esRolDirector } from '@/lib/roles'
import PdfUploadArea from '@/components/PdfUploadArea.vue'
import { dialog } from '@/lib/dialog'

const rol = localStorage.getItem('rol')
const esDirector = computed(() => esRolDirector(rol))

const documentos = ref<any[]>([])
const loading = ref(true)
const subiendo = ref(false)

const formData = ref({
  nombre: '',
  descripcion: '',
  archivo: null as File | null
})
const archivoNombre = ref('')

const toastVisible = ref(false)
const toastMensaje = ref('')
const toastTipo = ref<'success' | 'error'>('success')
let toastTimeout: ReturnType<typeof setTimeout>

const mostrarToast = (mensaje: string, tipo: 'success' | 'error' = 'success') => {
  toastMensaje.value = mensaje
  toastTipo.value = tipo
  toastVisible.value = true
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toastVisible.value = false }, 3500)
}

const cargarDocumentos = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'documentos'), orderBy('fecha_creacion', 'desc')))
    documentos.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const onPdfSelect = (file: File) => {
  formData.value.archivo = file
  archivoNombre.value = file.name
}

const onPdfError = (mensaje: string) => {
  mostrarToast(mensaje, 'error')
}

const subirDocumento = async () => {
  if (!formData.value.nombre.trim() || !formData.value.archivo) {
    mostrarToast('El nombre y el PDF son obligatorios', 'error')
    return
  }

  subiendo.value = true
  try {
    const fd = new FormData()
    fd.append('file', formData.value.archivo)
    fd.append('upload_preset', 'flexibilizaciones_pdf')

    const res = await fetch('https://api.cloudinary.com/v1_1/dhbehhvb5/image/upload', {
      method: 'POST', body: fd
    })
    const data = await res.json()

    if (!data.secure_url) {
      mostrarToast('Error al subir el PDF', 'error')
      return
    }

    await addDoc(collection(db, 'documentos'), {
      nombre: formData.value.nombre.trim(),
      descripcion: formData.value.descripcion.trim(),
      url: data.secure_url,
      fecha_creacion: serverTimestamp()
    })

    await cargarDocumentos()
    formData.value = { nombre: '', descripcion: '', archivo: null }
    archivoNombre.value = ''
    mostrarToast('Documento subido correctamente')
  } catch (e) {
    console.error(e)
    mostrarToast('Error al subir el documento', 'error')
  } finally {
    subiendo.value = false
  }
}

const eliminarDocumento = async (documento: { id: string; nombre?: string; descripcion?: string }) => {
  const nombreDoc = documento.descripcion || documento.nombre || 'este documento'
  const ok = await dialog.confirm(
    `¿Eliminar "${nombreDoc}"? Esta acción no se puede deshacer.`,
    {
      title: 'Eliminar documento',
      variant: 'danger',
      confirmText: 'Eliminar',
    },
  )
  if (!ok) return

  try {
    await deleteDoc(doc(db, 'documentos', documento.id))
    documentos.value = documentos.value.filter(d => d.id !== documento.id)
    mostrarToast('Documento eliminado')
  } catch (e) {
    console.error(e)
    mostrarToast('Error al eliminar el documento', 'error')
  }
}

onMounted(cargarDocumentos)
</script>

<template>
  <div class="recursos-page">

    <!-- Panel subir (solo director) -->
    <div v-if="esDirector" class="upload-panel">
      <h2 class="upload-title">Subir nuevo documento</h2>
      <div class="upload-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre del documento <span class="required">*</span></label>
            <input
              v-model="formData.nombre"
              type="text"
              class="form-input"
              placeholder="Ej. R-GA003 Formato Solicitud pruebas y Exámenes"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Descripción (opcional)</label>
            <input
              v-model="formData.descripcion"
              type="text"
              class="form-input"
              placeholder="Breve descripción del documento"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Archivo PDF <span class="required">*</span></label>
          <PdfUploadArea
            :file-name="archivoNombre"
            @select="onPdfSelect"
            @error="onPdfError"
          />
        </div>

        <button
          class="btn btn-primary"
          :disabled="subiendo || !formData.nombre.trim() || !formData.archivo"
          @click="subirDocumento"
        >
          <span v-if="subiendo" class="btn-spinner"></span>
          {{ subiendo ? 'Subiendo...' : 'Subir documento' }}
        </button>
      </div>
    </div>

    <!-- Lista documentos -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"/>
      <span>Cargando documentos...</span>
    </div>

    <div v-else-if="documentos.length === 0" class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <p>No hay documentos disponibles aún.</p>
    </div>

    <div v-else class="documentos-grid">
      <div
        v-for="documento in documentos"
        :key="documento.id"
        class="documento-card"
      >
        <div class="doc-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>

        <div class="doc-info">
          <span class="doc-titulo">{{ documento.descripcion || documento.nombre }}</span>
          <span v-if="documento.descripcion" class="doc-archivo">{{ documento.nombre }}</span>
        </div>

        <div class="doc-actions">
          <a :href="documento.url" target="_blank" class="btn-descargar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Descargar
          </a>
          <button
            v-if="esDirector"
            class="btn-eliminar"
            title="Eliminar documento"
            @click="eliminarDocumento(documento)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastVisible" :class="['toast', toastTipo === 'error' ? 'toast-error' : 'toast-success']">
          <div class="toast-icon">
            <svg v-if="toastTipo === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <span>{{ toastMensaje }}</span>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.recursos-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

/* Upload panel */
.upload-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
}
.upload-title { font-size: 15px; font-weight: 600; color: var(--color-text); margin: 0 0 20px; }
.upload-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
.required { color: #ef4444; }
.form-input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px; color: var(--color-text);
  background: var(--color-surface);
  width: 100%; box-sizing: border-box;
}
.form-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
  outline: none;
}

/* Botones */
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px; border-radius: var(--radius);
  font-size: 13px; font-weight: 500;
  border: none; cursor: pointer; transition: all var(--transition);
}
.btn-primary { background: var(--color-primary); color: white; width: fit-content; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-light); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white; border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* Lista */
.loading-state {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; padding: 60px 20px;
  color: var(--color-text-muted); font-size: 13px;
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 60px 20px;
  color: var(--color-text-muted); font-size: 13px; text-align: center;
}

.documentos-grid { display: flex; flex-direction: column; gap: 10px; }

.documento-card {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition);
}
.documento-card:hover { border-color: var(--color-accent); box-shadow: var(--shadow); }

.doc-icon {
  width: 44px; height: 44px;
  background: var(--color-info-bg); color: var(--color-accent);
  border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.doc-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.doc-titulo {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.doc-archivo {
  font-size: 12px;
  color: var(--color-text-muted);
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

.doc-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.btn-descargar {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 500; color: var(--color-accent);
  background: var(--color-info-bg); padding: 7px 12px;
  border-radius: var(--radius); text-decoration: none;
  transition: opacity var(--transition);
}
.btn-descargar:hover { opacity: 0.75; }

.btn-eliminar {
  width: 32px; height: 32px; border-radius: var(--radius);
  background: #fee2e2; color: #dc2626; border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all var(--transition);
}
.btn-eliminar:hover { background: #dc2626; color: white; }

/* Toast */
.toast {
  position: fixed; bottom: 28px; right: 28px; z-index: 2000;
  display: flex; align-items: center; gap: 12px;
  background: #111827; color: white;
  padding: 14px 20px; border-radius: 12px;
  font-size: 13px; font-weight: 500;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.toast-icon {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.toast-success .toast-icon { background: #10b981; }
.toast-error .toast-icon { background: #ef4444; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px) scale(0.95); }

@media (max-width: 640px) {
  .upload-panel {
    padding: 16px;
  }

  .form-row { grid-template-columns: 1fr; }

  .documento-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
  }

  .doc-info {
    width: 100%;
  }

  .doc-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .toast {
    left: 16px;
    right: 16px;
    bottom: 16px;
  }
}
</style>