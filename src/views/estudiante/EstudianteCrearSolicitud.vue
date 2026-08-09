<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { dialog } from '@/lib/dialog'

const route = useRoute()

const tipo = ref('')
const descripcion = ref('')
const archivo = ref<File | null>(null)
const archivoNombre = ref('')

const setTipoDesdeRuta = () => {
  tipo.value = (route.query.tipo as string) || ''
}

onMounted(setTipoDesdeRuta)
watch(() => route.query.tipo, setTipoDesdeRuta)

const handleFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const selectedFile = target.files?.[0] ?? null
  archivo.value = selectedFile
  archivoNombre.value = selectedFile?.name ?? ''
}

const enviar = async () => {
  if (!tipo.value || !descripcion.value) {
    await dialog.alert('Por favor completa el tipo y la descripción de la solicitud.', { variant: 'error' })
    return
  }

  console.log({
    tipo: tipo.value,
    descripcion: descripcion.value,
    archivo: archivo.value,
  })

  await dialog.alert('Solicitud enviada correctamente.', { variant: 'success', title: 'Listo' })
}
</script>

<template>
  <form class="form" @submit.prevent="enviar">
    <h2>Nueva solicitud</h2>

    <div class="field">
      <label>Tipo</label>
      <input v-model="tipo" disabled />
    </div>

    <div class="field">
      <label>Descripción</label>
      <textarea v-model="descripcion"></textarea>
    </div>

    <div class="field">
      <label>Archivo</label>
      <input type="file" @change="handleFile" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
      <p v-if="archivoNombre" class="file-name">Archivo seleccionado: {{ archivoNombre }}</p>
    </div>

    <button type="submit">Enviar</button>
  </form>
</template>

<style scoped>
.form {
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-name {
  margin: 0;
  font-size: 0.9rem;
  color: #4b5563;
}
</style>