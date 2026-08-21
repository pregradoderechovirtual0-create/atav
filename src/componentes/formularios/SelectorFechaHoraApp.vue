<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  MESES_NOMBRES,
  DIAS_SEMANA_CORTOS,
  construirDiasCalendario,
  esDiaHabilitado,
  formatFechaLegible,
  formatHoraLegible,
  parseDatetimeLocal,
  toDatetimeLocal,
  type CeldaCalendario,
} from '@/lib/ui/calendarioFormulario'

const props = defineProps<{
  modelValue: string
  min?: string
  max?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const hoy = new Date()
const calMes = ref(hoy.getMonth())
const calAnio = ref(hoy.getFullYear())

const fechaSel = ref('')
const horaSel = ref('')

const horasOpciones = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutosOpciones = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const horaParte = computed({
  get: () => horaSel.value.split(':')[0] || '08',
  set: (h: string) => {
    const m = horaSel.value.split(':')[1] || '00'
    horaSel.value = `${h.padStart(2, '0').slice(-2)}:${m}`
    emitirValor()
  },
})

const minutoParte = computed({
  get: () => horaSel.value.split(':')[1] || '00',
  set: (m: string) => {
    const h = horaSel.value.split(':')[0] || '08'
    horaSel.value = `${h}:${m.padStart(2, '0').slice(-2)}`
    emitirValor()
  },
})

const sincronizarDesdeModel = (valor: string) => {
  const { fecha, hora } = parseDatetimeLocal(valor)
  fechaSel.value = fecha
  horaSel.value = hora || '08:00'
  if (fecha) {
    const [y, m] = fecha.split('-').map(Number)
    if (y && m) {
      calAnio.value = y
      calMes.value = m - 1
    }
  }
}

watch(() => props.modelValue, sincronizarDesdeModel, { immediate: true })

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

const emitirValor = () => {
  if (!fechaSel.value || !horaSel.value) {
    emit('update:modelValue', '')
    return
  }
  emit('update:modelValue', toDatetimeLocal(fechaSel.value, horaSel.value))
}

const seleccionarDia = (celda: CeldaCalendario | null) => {
  if (!celdaDisponible(celda)) return
  fechaSel.value = celda!.iso
  if (!horaSel.value) horaSel.value = '08:00'
  emitirValor()
}

const limpiar = () => {
  fechaSel.value = ''
  horaSel.value = ''
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="selector-fecha-hora">
    <div v-if="modelValue" class="selector-resumen">
      <span class="selector-chip">
        {{ formatFechaLegible(fechaSel) }} · {{ formatHoraLegible(horaSel) }}
      </span>
      <button type="button" class="selector-clear" @click="limpiar">Limpiar</button>
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
            seleccionado: celda && fechaSel === celda.iso,
          }]"
          @click="seleccionarDia(celda)"
        >
          <span v-if="celda" class="cal-num">{{ celda.dia }}</span>
        </div>
      </div>
    </div>

    <div v-if="fechaSel" class="hora-libre-wrap">
      <p class="hora-libre-titulo">
        Hora de reprogramación — <strong>{{ formatFechaLegible(fechaSel) }}</strong>
      </p>
      <div class="hora-libre">
        <div class="hora-campo">
          <label class="hora-campo-label">Hora</label>
          <select v-model="horaParte" class="hora-select">
            <option v-for="h in horasOpciones" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>
        <span class="hora-sep">:</span>
        <div class="hora-campo">
          <label class="hora-campo-label">Minutos</label>
          <select v-model="minutoParte" class="hora-select">
            <option v-for="m in minutosOpciones" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>
      <p class="hora-libre-preview">
        Seleccionado: <strong>{{ formatHoraLegible(horaSel) }}</strong>
      </p>
    </div>
  </div>
</template>

<style scoped>
.selector-resumen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.selector-chip {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  padding: 6px 12px;
  border-radius: var(--radius);
}

.selector-clear {
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.selector-clear:hover {
  color: var(--color-text);
}

.cal-wrapper {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px;
  margin-bottom: 12px;
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

.hora-libre-wrap {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px;
  background: var(--color-surface);
}

.hora-libre-titulo {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 12px;
}

.hora-libre {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.hora-campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.hora-campo-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-text-muted);
}

.hora-select {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--transition);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px;
}

.hora-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.hora-sep {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-muted);
  padding-bottom: 10px;
}

.hora-libre-preview {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.hora-libre-preview strong {
  color: var(--color-primary);
}

@media (max-width: 640px) {
  .selector-resumen {
    flex-direction: column;
    align-items: flex-start;
  }

  .cal-mes-label {
    font-size: 13px;
  }

  .cal-nav-btn {
    width: 36px;
    height: 36px;
  }

  .cal-grid {
    gap: 3px;
  }

  .cal-celda {
    min-height: 36px;
    font-size: 12px;
  }

  .hora-libre {
    flex-direction: column;
    align-items: stretch;
  }

  .hora-sep {
    display: none;
  }

  .hora-libre-preview {
    word-break: break-word;
  }
}

@media (max-width: 380px) {
  .cal-wrapper,
  .hora-libre-wrap {
    padding: 10px;
  }

  .cal-head {
    font-size: 9px;
  }

  .cal-celda {
    min-height: 32px;
    font-size: 11px;
  }
}
</style>
