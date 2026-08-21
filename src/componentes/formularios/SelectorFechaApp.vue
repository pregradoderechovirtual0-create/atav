<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  MESES_NOMBRES,
  DIAS_SEMANA_CORTOS,
  construirDiasCalendario,
  esDiaHabilitado,
  formatFechaLegible,
  type CeldaCalendario,
} from '@/lib/ui/calendarioFormulario'

const props = defineProps<{
  modelValue: string
  min?: string
  max?: string
  compact?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const hoy = new Date()
const calMes = ref(hoy.getMonth())
const calAnio = ref(hoy.getFullYear())

const irAMesDe = (iso: string) => {
  if (!iso) return
  const [y, m] = iso.split('-').map(Number)
  if (y && m) {
    calAnio.value = y
    calMes.value = m - 1
  }
}

watch(
  () => props.modelValue,
  (valor) => { if (valor) irAMesDe(valor) },
  { immediate: true },
)

const diasCalendario = computed(() =>
  construirDiasCalendario(calMes.value, calAnio.value, props.min, props.max),
)

const calAnterior = () => {
  if (calMes.value === 0) { calMes.value = 11; calAnio.value-- } else calMes.value--
}

const calSiguiente = () => {
  if (calMes.value === 11) { calMes.value = 0; calAnio.value++ } else calMes.value++
}

const celdaDisponible = (celda: CeldaCalendario | null) =>
  !!celda && esDiaHabilitado(celda.iso, props.min, props.max)

const seleccionarDia = (celda: CeldaCalendario | null) => {
  if (!celdaDisponible(celda)) return
  emit('update:modelValue', celda!.iso)
}

const limpiar = () => emit('update:modelValue', '')
</script>

<template>
  <div :class="['selector-fecha', { 'selector-fecha--compact': compact }]">
    <div v-if="modelValue" class="selector-fecha-resumen">
      <span class="selector-fecha-chip">{{ formatFechaLegible(modelValue) }}</span>
      <button type="button" class="selector-fecha-clear" @click="limpiar">Cambiar</button>
    </div>

    <div class="cal-wrapper">
      <div class="cal-nav">
        <button class="cal-nav-btn" type="button" aria-label="Mes anterior" @click="calAnterior">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="cal-mes-label">{{ MESES_NOMBRES[calMes] }} {{ calAnio }}</span>
        <button class="cal-nav-btn" type="button" aria-label="Mes siguiente" @click="calSiguiente">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="cal-grid">
        <div v-for="ds in DIAS_SEMANA_CORTOS" :key="ds" class="cal-head">{{ ds }}</div>
        <div
          v-for="(celda, i) in diasCalendario"
          :key="i"
          :class="['cal-celda', {
            vacia: !celda,
            disponible: celdaDisponible(celda),
            nodisponible: celda && !celdaDisponible(celda),
            seleccionado: celda && modelValue === celda.iso,
          }]"
          @click="seleccionarDia(celda)"
        >
          <span v-if="celda" class="cal-num">{{ celda.dia }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.selector-fecha-resumen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.selector-fecha-chip {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  padding: 6px 12px;
  border-radius: var(--radius);
}

.selector-fecha-clear {
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.selector-fecha-clear:hover {
  color: var(--color-text);
}

.cal-wrapper {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px;
}

.selector-fecha--compact .cal-wrapper {
  padding: 10px;
}

.cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cal-mes-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.cal-nav-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
  color: var(--color-text-secondary);
}

.cal-nav-btn:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-head {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 4px 0;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.cal-celda {
  aspect-ratio: 1;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all var(--transition);
}

.cal-celda.disponible {
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.cal-celda.disponible:hover {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
}

.cal-celda.seleccionado {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.cal-celda.seleccionado .cal-num {
  color: white;
  font-weight: 700;
}

.cal-celda.nodisponible {
  color: var(--color-text-muted);
  opacity: 0.35;
  cursor: not-allowed;
}

.cal-num {
  font-weight: 500;
}

@media (max-width: 640px) {
  .selector-fecha-resumen,
  .selector-resumen {
    flex-direction: column;
    align-items: flex-start;
  }

  .cal-mes-label {
    font-size: 13px;
    text-align: center;
  }

  .cal-nav-btn {
    width: 36px;
    height: 36px;
  }

  .cal-grid {
    gap: 3px;
  }

  .cal-head {
    font-size: 10px;
  }

  .cal-celda {
    font-size: 12px;
    min-height: 36px;
  }
}

@media (max-width: 380px) {
  .cal-wrapper {
    padding: 10px;
  }

  .cal-head {
    font-size: 9px;
    letter-spacing: 0;
  }

  .cal-celda {
    font-size: 11px;
    min-height: 32px;
    border-radius: 6px;
  }
}
</style>
