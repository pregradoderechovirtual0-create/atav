<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  fileName?: string
  hint?: string
  required?: boolean
}>(), {
  fileName: '',
  hint: 'PDF · Máx. 5 MB',
  required: false,
})

const emit = defineEmits<{
  select: [file: File]
  error: [message: string]
}>()

const dragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const esPdf = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

const procesarArchivo = (file: File | undefined | null) => {
  if (!file) return
  if (esPdf(file)) {
    emit('select', file)
  } else {
    emit('error', 'Solo se permiten archivos PDF.')
    if (inputRef.value) inputRef.value.value = ''
  }
}

const onInputChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  procesarArchivo(input.files?.[0])
}

const onDragEnter = (e: DragEvent) => {
  dragging.value = true
}

const onDragLeave = (e: DragEvent) => {
  const zone = e.currentTarget as HTMLElement
  const related = e.relatedTarget as Node | null
  if (related && zone.contains(related)) return
  dragging.value = false
}

const onDrop = (e: DragEvent) => {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  procesarArchivo(file)
}

const abrirSelector = () => inputRef.value?.click()
</script>

<template>
  <div class="pdf-upload">
    <input
      ref="inputRef"
      type="file"
      accept="application/pdf,.pdf"
      class="pdf-upload-input"
      @change="onInputChange"
    />
    <div
      class="pdf-upload-area"
      :class="{
        'has-file': fileName,
        'is-dragging': dragging,
      }"
      role="button"
      tabindex="0"
      @click="abrirSelector"
      @keydown.enter.prevent="abrirSelector"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div class="pdf-upload-content">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span v-if="fileName" class="pdf-upload-filename">{{ fileName }}</span>
        <span v-else class="pdf-upload-placeholder">
          {{ dragging ? 'Suelta el archivo aquí' : 'Haz clic para subir o arrastra el archivo' }}
        </span>
        <span class="pdf-upload-hint">{{ hint }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-upload-input {
  display: none;
}

.pdf-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px 20px;
  cursor: pointer;
  transition: all var(--transition);
  text-align: center;
  user-select: none;
}

.pdf-upload-area:hover {
  border-color: var(--sol-accent, var(--color-accent));
  background: color-mix(in srgb, var(--sol-accent, var(--color-accent)) 6%, var(--color-surface));
}

.pdf-upload-area.has-file {
  border-color: var(--color-success);
  background: #f0fdf4;
}

.pdf-upload-area.is-dragging {
  border-color: var(--sol-accent, var(--color-accent));
  background: color-mix(in srgb, var(--sol-accent, var(--color-accent)) 10%, var(--color-surface));
  border-style: solid;
}

.pdf-upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.pdf-upload-filename {
  font-size: 13px;
  font-weight: 500;
  color: #16a34a;
  word-break: break-all;
}

.pdf-upload-placeholder {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.pdf-upload-hint {
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
