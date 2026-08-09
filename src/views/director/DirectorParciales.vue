<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  cargarConfigParciales,
  guardarConfigParciales,
  formatRango,
  type ConfigParciales,
  type ParcialRango,
} from '@/lib/parciales'

const loading = ref(true)
const guardando = ref(false)
const toast = ref('')

const form = ref({
  periodo: '',
  notas: '',
  parcial_1: { inicio: '', fin: '' },
  parcial_2: { inicio: '', fin: '' },
  parcial_3: { inicio: '', fin: '' },
})

const parcialesMeta = [
  { id: '1', key: 'parcial_1' as const, label: 'Parcial 1' },
  { id: '2', key: 'parcial_2' as const, label: 'Parcial 2' },
  { id: '3', key: 'parcial_3' as const, label: 'Parcial 3' },
]

onMounted(async () => {
  const config = await cargarConfigParciales()
  form.value = {
    periodo: config.periodo,
    notas: config.notas,
    parcial_1: config.parcial_1 ?? { inicio: '', fin: '' },
    parcial_2: config.parcial_2 ?? { inicio: '', fin: '' },
    parcial_3: config.parcial_3 ?? { inicio: '', fin: '' },
  }
  loading.value = false
})

const validar = (): string | null => {
  if (!form.value.periodo.trim()) return 'Indica el periodo académico (ej. 2028A, 2027B)'
  for (const p of parcialesMeta) {
    const r = form.value[p.key]
    if (!r.inicio || !r.fin) return `Completa las fechas de ${p.label}`
    if (r.fin < r.inicio) return `En ${p.label}, la fecha fin debe ser posterior al inicio`
  }
  return null
}

const guardar = async () => {
  const error = validar()
  if (error) {
    toast.value = error
    setTimeout(() => { toast.value = '' }, 3000)
    return
  }

  guardando.value = true
  try {
    const payload: ConfigParciales = {
      periodo: form.value.periodo.trim(),
      notas: form.value.notas.trim(),
      parcial_1: form.value.parcial_1.inicio ? form.value.parcial_1 : null,
      parcial_2: form.value.parcial_2.inicio ? form.value.parcial_2 : null,
      parcial_3: form.value.parcial_3.inicio ? form.value.parcial_3 : null,
    }
    await guardarConfigParciales(payload)
    toast.value = 'Configuración guardada correctamente'
  } catch (e) {
    console.error(e)
    toast.value = 'Error al guardar. Verifica permisos en Firestore.'
  } finally {
    guardando.value = false
    setTimeout(() => { toast.value = '' }, 3000)
  }
}

const ventanaPreview = (rango: ParcialRango) => {
  if (!rango.inicio || !rango.fin) return ''
  const inicio = new Date(rango.inicio + 'T12:00:00')
  inicio.setDate(inicio.getDate() - 7)
  const desde = inicio.toISOString().split('T')[0]
  return `Estudiantes podrán elegir del ${formatRango({ inicio: desde, fin: rango.fin })}`
}
</script>

<template>
  <div class="parciales-page">
    <p class="page-desc">
      Define el periodo académico y el rango de fechas de cada parcial. Los estudiantes solo podrán
      seleccionar fechas desde <strong>1 semana antes</strong> del inicio hasta el fin del parcial.
    </p>

    <div v-if="loading" class="loading">Cargando...</div>

    <template v-else>
      <section class="periodo-card">
        <h3>Periodo académico</h3>
        <div class="periodo-fields">
          <label>
            <span>Etiqueta del periodo</span>
            <input
              v-model="form.periodo"
              type="text"
              placeholder="Ej. 2028A, 2027B"
              maxlength="20"
            />
          </label>
          <label class="full">
            <span>Notas (opcional)</span>
            <textarea
              v-model="form.notas"
              rows="2"
              placeholder="Observaciones sobre este periodo, cambios o instrucciones..."
            />
          </label>
        </div>
      </section>

      <div class="parciales-grid">
        <section v-for="p in parcialesMeta" :key="p.id" class="parcial-card">
          <h3>{{ p.label }}</h3>
          <div class="fields">
            <label>
              <span>Fecha inicio del parcial</span>
              <input v-model="form[p.key].inicio" type="date" />
            </label>
            <label>
              <span>Fecha fin del parcial</span>
              <input v-model="form[p.key].fin" type="date" :min="form[p.key].inicio" />
            </label>
          </div>
          <p v-if="form[p.key].inicio && form[p.key].fin" class="preview">
            {{ ventanaPreview(form[p.key]) }}
          </p>
        </section>
      </div>
    </template>

    <button class="btn-save" :disabled="guardando || loading" @click="guardar">
      {{ guardando ? 'Guardando...' : 'Guardar configuración' }}
    </button>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.parciales-page {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.loading {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 40px 0;
  text-align: center;
}

.periodo-card,
.parcial-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
}

.periodo-card h3,
.parcial-card h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 14px;
}

.periodo-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.periodo-fields .full {
  grid-column: 1 / -1;
}

.parciales-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label span {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

input[type="text"],
input[type="date"],
textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-background);
  font-family: inherit;
}

textarea {
  resize: vertical;
  min-height: 64px;
}

input:focus,
textarea:focus {
  border-color: var(--color-accent);
  outline: none;
}

.preview {
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-accent);
  background: var(--color-info-bg);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
}

.btn-save {
  align-self: flex-start;
  padding: 11px 20px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  transition: opacity var(--transition);
}

.btn-save:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--color-primary);
  color: white;
  padding: 12px 18px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow-md);
  z-index: 100;
}

@media (max-width: 600px) {
  .fields,
  .periodo-fields {
    grid-template-columns: 1fr;
  }
}
</style>
