<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { agruparMateriasPorSemestre, filtrarMaterias, type MateriaRegistrada } from '@/lib/materias'

const props = withDefaults(defineProps<{
  materias: MateriaRegistrada[]
  modelValue: string
  showSearch?: boolean
}>(), {
  showSearch: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const busquedaLocal = ref('')
const semestresAbiertos = ref<Record<string, boolean>>({})

const materiasFiltradas = computed(() =>
  filtrarMaterias(props.materias, props.showSearch ? busquedaLocal.value : ''),
)

const gruposSemestre = computed(() => agruparMateriasPorSemestre(materiasFiltradas.value))

const materiaSeleccionada = computed(() =>
  props.materias.find(m => m.codigo === props.modelValue) ?? null,
)

const semestreDeSeleccion = computed(() => {
  if (!materiaSeleccionada.value) return null
  return materiaSeleccionada.value.semestre?.trim() || 'Sin semestre asignado'
})

const toggleSemestre = (semestre: string) => {
  semestresAbiertos.value[semestre] = !semestresAbiertos.value[semestre]
}

const estaAbierto = (semestre: string) => {
  if (busquedaLocal.value.trim()) return true
  return semestresAbiertos.value[semestre] ?? semestre === semestreDeSeleccion.value
}

const seleccionar = (codigo: string, semestre: string) => {
  emit('update:modelValue', codigo)
  semestresAbiertos.value[semestre] = true
}

watch(gruposSemestre, (grupos) => {
  for (const g of grupos) {
    if (semestreDeSeleccion.value === g.semestre) {
      semestresAbiertos.value[g.semestre] = true
    }
  }
}, { immediate: true })

watch(() => props.modelValue, () => {
  if (semestreDeSeleccion.value) {
    semestresAbiertos.value[semestreDeSeleccion.value] = true
  }
})
</script>

<template>
  <div class="sol-materia-select">
    <div v-if="showSearch" class="search-box">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        v-model="busquedaLocal"
        type="text"
        class="sol-form-input search-input"
        placeholder="Buscar por código o nombre..."
      />
    </div>

    <div v-if="materiaSeleccionada" class="sol-materia-seleccionada-resumen">
      <span class="sol-materia-seleccionada-label">Seleccionada:</span>
      <span class="tipo-codigo">{{ materiaSeleccionada.codigo }}</span>
      <span class="sol-materia-seleccionada-nombre">{{ materiaSeleccionada.nombre }}</span>
    </div>

    <p v-if="!materias.length" class="sol-pendientes-empty">No hay materias registradas.</p>
    <p v-else-if="!gruposSemestre.length" class="sol-pendientes-empty">No se encontraron materias.</p>

    <div v-else class="sol-materia-acordeon">
      <section
        v-for="grupo in gruposSemestre"
        :key="grupo.semestre"
        class="sol-materia-acordeon-item"
        :class="{ open: estaAbierto(grupo.semestre) }"
      >
        <button
          type="button"
          class="sol-materia-acordeon-trigger"
          :aria-expanded="estaAbierto(grupo.semestre)"
          @click="toggleSemestre(grupo.semestre)"
        >
          <span class="sol-materia-acordeon-title">{{ grupo.semestre }}</span>
          <span class="sol-materia-acordeon-count">{{ grupo.items.length }} materias</span>
          <svg class="sol-materia-acordeon-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div v-show="estaAbierto(grupo.semestre)" class="sol-materia-acordeon-panel">
          <button
            v-for="m in grupo.items"
            :key="m.codigo"
            type="button"
            :class="['sol-materia-acordeon-option', { selected: modelValue === m.codigo }]"
            @click="seleccionar(m.codigo, grupo.semestre)"
          >
            <span class="sol-materia-acordeon-option-radio" aria-hidden="true">
              <span v-if="modelValue === m.codigo" class="sol-materia-acordeon-option-dot"/>
            </span>
            <span class="tipo-content">
              <span class="tipo-codigo">{{ m.codigo }}</span>
              <span class="sol-opcion-label">{{ m.nombre }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
