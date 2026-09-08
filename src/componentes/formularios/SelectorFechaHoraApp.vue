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

interface FechaReprogramacion {
  inicio: string
  fin: string
}

const props = defineProps<{
  modelValue: FechaReprogramacion
  min?: string
  max?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [FechaReprogramacion]
}>()

const obtenerFechaHoy = () => {
  const ahora = new Date()
  const año = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')

  return `${año}-${mes}-${dia}`
}

const obtenerHoraActual = () => {
  const ahora = new Date()
  const hora = String(ahora.getHours()).padStart(2, '0')
  const minuto = String(ahora.getMinutes()).padStart(2, '0')

  return `${hora}:${minuto}`
}

const fechaMinima = computed(() => {
  const hoy = obtenerFechaHoy()

  if (!props.min) {
    return hoy
  }

  const minFecha = props.min.includes('T')
    ? props.min.split('T')[0]
    : props.min

  return minFecha > hoy ? minFecha : hoy
})

const hoy = new Date()

const calMes = ref(hoy.getMonth())
const calAnio = ref(hoy.getFullYear())

const fechaSel = ref('')
const horaSel = ref('08:00')
const horaFin = ref('10')
const minutoFin = ref('00')

const horasOpciones = Array.from(
  { length: 24 },
  (_, i) => String(i).padStart(2, '0'),
)

const minutosOpciones = Array.from(
  { length: 60 },
  (_, i) => String(i).padStart(2, '0'),
)

/*
 * Hora de inicio
 */

const horaParte = computed({
  get: () => horaSel.value.split(':')[0] || '08',

  set: (h: string) => {
    const minuto = horaSel.value.split(':')[1] || '00'

    horaSel.value =
      `${h.padStart(2, '0').slice(-2)}:${minuto}`

    emitirValor()
  },
})

const minutoParte = computed({
  get: () => horaSel.value.split(':')[1] || '00',

  set: (m: string) => {
    const hora = horaSel.value.split(':')[0] || '08'

    horaSel.value =
      `${hora}:${m.padStart(2, '0').slice(-2)}`

    emitirValor()
  },
})

/*
 * Hora de finalización
 */

const emitirValor = () => {
  if (!fechaSel.value || !horaSel.value) {
    emit('update:modelValue', {
      inicio: '',
      fin: '',
    })

    return
  }

  const inicio = toDatetimeLocal(
    fechaSel.value,
    horaSel.value,
  )

  const fin = toDatetimeLocal(
    fechaSel.value,
    `${horaFin.value}:${minutoFin.value}`,
  )

  /*
   * La hora de finalización debe ser posterior
   * a la hora de inicio.
   */
  if (
    new Date(fin).getTime() <=
    new Date(inicio).getTime()
  ) {
    return
  }

  emit('update:modelValue', {
    inicio,
    fin,
  })
}

/*
 * Sincronizar el componente cuando
 * recibe un valor desde el padre.
 */

const sincronizarDesdeModel = (
  valor: FechaReprogramacion,
) => {
  const inicio = valor?.inicio || ''
  const fin = valor?.fin || ''

  const datosInicio = parseDatetimeLocal(inicio)
  const datosFin = parseDatetimeLocal(fin)

  fechaSel.value = datosInicio.fecha

  horaSel.value =
    datosInicio.hora || '08:00'

  if (datosFin.hora) {
    const [hora, minuto] =
      datosFin.hora.split(':')

    horaFin.value = hora || '10'
    minutoFin.value = minuto || '00'
  } else {
    /*
     * Valor predeterminado:
     * 2 horas después del inicio.
     */
    const [horaInicio] =
      horaSel.value.split(':').map(Number)

    const horaFinal =
      Math.min(horaInicio + 2, 23)

    horaFin.value =
      String(horaFinal).padStart(2, '0')

    minutoFin.value =
      horaSel.value.split(':')[1] || '00'
  }

  if (fechaSel.value) {
    const [y, m] =
      fechaSel.value.split('-').map(Number)

    if (y && m) {
      calAnio.value = y
      calMes.value = m - 1
    }
  }
}

watch(
  () => props.modelValue,
  sincronizarDesdeModel,
  {
    immediate: true,
    deep: true,
  },
)

/*
 * Calendario
 */

const diasCalendario = computed(() =>
  construirDiasCalendario(
    calMes.value,
    calAnio.value,
    fechaMinima.value,
    props.max,
  ),
)

const calAnterior = () => {
  if (calMes.value === 0) {
    calMes.value = 11
    calAnio.value--
  } else {
    calMes.value--
  }
}

const calSiguiente = () => {
  if (calMes.value === 11) {
    calMes.value = 0
    calAnio.value++
  } else {
    calMes.value++
  }
}

const celdaDisponible = (
  celda: CeldaCalendario | null,
) =>
  !!celda &&
  esDiaHabilitado(
    celda.iso,
    fechaMinima.value,
    props.max,
  )

/*
 * Validación de horas
 */

const horaInicioEsValida = (
  hora: string,
) => {
  if (!fechaSel.value || !hora) {
    return false
  }

  const fechaHoy = obtenerFechaHoy()

  if (fechaSel.value !== fechaHoy) {
    return true
  }

  const horaActual = obtenerHoraActual()

  return hora >= horaActual
}

const horasDisponibles = computed(() => {
  if (!fechaSel.value) {
    return horasOpciones
  }

  const fechaHoy = obtenerFechaHoy()

  if (fechaSel.value !== fechaHoy) {
    return horasOpciones
  }

  const horaActual =
    Number(
      obtenerHoraActual()
        .split(':')[0],
    )

  return horasOpciones.filter(
    hora =>
      Number(hora) >= horaActual,
  )
})

const minutosDisponibles = computed(() => {
  if (!fechaSel.value) {
    return minutosOpciones
  }

  const fechaHoy = obtenerFechaHoy()

  if (fechaSel.value !== fechaHoy) {
    return minutosOpciones
  }

  const [
    horaActual,
    minutoActual,
  ] =
    obtenerHoraActual()
      .split(':')
      .map(Number)

  const horaSeleccionada =
    Number(
      horaSel.value
        .split(':')[0] || 0,
    )

  if (
    horaSeleccionada >
    horaActual
  ) {
    return minutosOpciones
  }

  if (
    horaSeleccionada ===
    horaActual
  ) {
    return minutosOpciones.filter(
      minuto =>
        Number(minuto) >=
        minutoActual,
    )
  }

  return []
})

/*
 * Horas de finalización
 *
 * La finalización solamente puede ser
 * posterior a la hora de inicio.
 */

const horasFinDisponibles = computed(() => {
  if (!horaSel.value) {
    return horasOpciones
  }

  const horaInicio =
    Number(
      horaSel.value.split(':')[0],
    )

  return horasOpciones.filter(
    hora =>
      Number(hora) > horaInicio,
  )
})

const minutosFinDisponibles = computed(() => {
  if (!horaSel.value || !horaFin.value) {
    return minutosOpciones
  }

  const [
    horaInicio,
    minutoInicio,
  ] =
    horaSel.value
      .split(':')
      .map(Number)

  const horaFinal =
    Number(horaFin.value)

  /*
   * Si la hora final es posterior,
   * cualquier minuto es válido.
   */
  if (horaFinal > horaInicio) {
    return minutosOpciones
  }

  /*
   * Si fuera la misma hora,
   * solamente permitiría minutos posteriores.
   */
  return minutosOpciones.filter(
    minuto =>
      Number(minuto) >
      minutoInicio,
  )
})

const horarioValido = computed(() => {
  if (
    !fechaSel.value ||
    !horaSel.value ||
    !horaFin.value ||
    !minutoFin.value
  ) {
    return false
  }

  const inicio = new Date(
    toDatetimeLocal(
      fechaSel.value,
      horaSel.value,
    ),
  )

  const fin = new Date(
    toDatetimeLocal(
      fechaSel.value,
      `${horaFin.value}:${minutoFin.value}`,
    ),
  )

  return fin.getTime() > inicio.getTime()
})

/*
 * Seleccionar día
 */

const seleccionarDia = (
  celda: CeldaCalendario | null,
) => {
  if (!celdaDisponible(celda)) {
    return
  }

  fechaSel.value = celda!.iso

  /*
   * Si se selecciona hoy,
   * la hora de inicio debe ser futura.
   */
  if (
    fechaSel.value ===
    obtenerFechaHoy()
  ) {
    const horaActual =
      obtenerHoraActual()

    if (
      !horaSel.value ||
      !horaInicioEsValida(
        horaSel.value,
      )
    ) {
      const [
        hora,
        minuto,
      ] =
        horaActual
          .split(':')
          .map(Number)

      let nuevaHora = hora
      let nuevoMinuto =
        minuto + 1

      if (nuevoMinuto >= 60) {
        nuevaHora++
        nuevoMinuto = 0
      }

      if (nuevaHora >= 24) {
        horaSel.value = '23:59'
      } else {
        horaSel.value =
          `${String(nuevaHora).padStart(2, '0')}:${String(nuevoMinuto).padStart(2, '0')}`
      }
    }
  }

  /*
   * Si no hay hora de inicio,
   * utilizar 08:00.
   */
  if (!horaSel.value) {
    horaSel.value = '08:00'
  }

  /*
   * Colocar automáticamente la
   * finalización 2 horas después.
   */
  const [
    horaInicio,
    minutoInicio,
  ] =
    horaSel.value
      .split(':')
      .map(Number)

  let nuevaHoraFin =
    horaInicio + 2

  if (nuevaHoraFin >= 24) {
    nuevaHoraFin = 23
  }

  horaFin.value =
    String(nuevaHoraFin)
      .padStart(2, '0')

  minutoFin.value =
    String(minutoInicio)
      .padStart(2, '0')

  emitirValor()
}

/*
 * Limpiar
 */

const limpiar = () => {
  fechaSel.value = ''
  horaSel.value = ''
  horaFin.value = '10'
  minutoFin.value = '00'

  emit(
    'update:modelValue',
    {
      inicio: '',
      fin: '',
    },
  )
}
</script>

<template>
  <div class="selector-fecha-hora">

    <!-- Calendario -->

    <div class="calendario">

      <div class="calendario-header">

        <button
          type="button"
          class="cal-btn"
          @click="calAnterior"
        >
          ‹
        </button>

        <strong>
          {{ MESES_NOMBRES[calMes] }}
          {{ calAnio }}
        </strong>

        <button
          type="button"
          class="cal-btn"
          @click="calSiguiente"
        >
          ›
        </button>

      </div>

      <div class="calendario-semana">
        <span
          v-for="dia in DIAS_SEMANA_CORTOS"
          :key="dia"
        >
          {{ dia }}
        </span>
      </div>

      <div class="calendario-dias">

        <button
          v-for="(celda, index) in diasCalendario"
          :key="index"
          type="button"
          class="cal-dia"
          :class="{
            'dia-vacio': !celda,
            'dia-seleccionado':
              celda &&
              celda.iso === fechaSel,
            'dia-deshabilitado':
              celda &&
              !celdaDisponible(celda),
          }"
          :disabled="
            !celda ||
            !celdaDisponible(celda)
          "
          @click="seleccionarDia(celda)"
        >
          {{ celda?.dia || '' }}
        </button>

      </div>
    </div>

    <!-- Horarios -->

    <div
      v-if="fechaSel"
      class="hora-libre-wrap"
    >

      <p class="hora-libre-titulo">
        Reprogramación —
        <strong>
          {{ formatFechaLegible(fechaSel) }}
        </strong>
      </p>

      <!-- Hora de inicio -->

      <div class="hora-libre">

        <div class="hora-campo">

          <label class="hora-campo-label">
            Hora de inicio
          </label>

          <select
            v-model="horaParte"
            class="hora-select"
          >
            <option
              v-for="h in horasDisponibles"
              :key="h"
              :value="h"
            >
              {{ h }}
            </option>
          </select>

        </div>

        <span class="hora-sep">
          :
        </span>

        <div class="hora-campo">

          <label class="hora-campo-label">
            Minutos
          </label>

          <select
            v-model="minutoParte"
            class="hora-select"
          >
            <option
              v-for="m in minutosDisponibles"
              :key="m"
              :value="m"
            >
              {{ m }}
            </option>
          </select>

        </div>

      </div>

      <!-- Hora de finalización -->

      <div class="hora-libre">

  <div class="hora-campo">

    <label class="hora-campo-label">
      Hora de finalización
    </label>

    <select
      v-model="horaFin"
      class="hora-select"
      @change="emitirValor"
    >
      <option
        v-for="hora in horasFinDisponibles"
        :key="hora"
        :value="hora"
      >
        {{ hora }}
      </option>
    </select>

  </div>

  <span class="hora-sep">
    :
  </span>

  <div class="hora-campo">

    <label class="hora-campo-label">
      Minutos
    </label>

    <select
      v-model="minutoFin"
      class="hora-select"
      @change="emitirValor"
    >
      <option
        v-for="minuto in minutosFinDisponibles"
        :key="minuto"
        :value="minuto"
      >
        {{ minuto }}
      </option>
    </select>

  </div>

</div>

      <!-- Error de horario -->

      <p
        v-if="
          horaSel &&
          horaFin &&
          minutoFin &&
          !horarioValido
        "
        class="hora-error"
      >
        La hora de finalización debe ser
        posterior a la hora de inicio.
      </p>

      <!-- Vista previa -->

      <p class="hora-libre-preview">

        Inicio:
        <strong>
          {{ formatHoraLegible(horaSel) }}
        </strong>

        &nbsp; — &nbsp;

        Finalización:
        <strong>
          {{ horaFin }}:{{ minutoFin }}
        </strong>

      </p>

    </div>

  </div>
</template>



<style scoped>

.selector-fecha-hora {
  width: 100%;
}

/* =========================
   CALENDARIO
   ========================= */

.calendario {
  width: 100%;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px;
  margin-bottom: 12px;
  box-sizing: border-box;
}

/* Cabecera del calendario */

.calendario-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.calendario-header strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  text-transform: capitalize;
}

.cal-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-surface);

  display: flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 20px;
  line-height: 1;

  transition: all var(--transition);
}

.cal-btn:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

/* =========================
   DÍAS DE LA SEMANA
   ========================= */

.calendario-semana {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;

  margin-bottom: 4px;
}

.calendario-semana span {
  display: flex;
  align-items: center;
  justify-content: center;

  min-width: 0;
  padding: 4px 0;

  text-align: center;

  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);

  text-transform: uppercase;
  letter-spacing: 0.2px;
}

/* =========================
   DÍAS DEL CALENDARIO
   ========================= */

.calendario-dias {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.cal-dia {
  width: 100%;
  min-width: 0;
  aspect-ratio: 1;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  border-radius: var(--radius);
  border: 1px solid transparent;

  background: var(--color-surface);
  color: var(--color-text);

  font-size: 13px;
  font-weight: 500;

  cursor: pointer;

  transition:
    background var(--transition),
    border-color var(--transition),
    color var(--transition);
}

/* Hover */

.cal-dia:hover:not(:disabled):not(.dia-seleccionado) {
  border-color: var(--color-primary);
  background: color-mix(
    in srgb,
    var(--color-primary) 8%,
    var(--color-surface)
  );
}

/* Día seleccionado */

.cal-dia.dia-seleccionado {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  font-weight: 700;
}

/* Día deshabilitado */

.cal-dia.dia-deshabilitado {
  color: var(--color-text-muted);
  opacity: 0.35;
  cursor: not-allowed;
}

/* Celdas vacías */

.cal-dia.dia-vacio {
  visibility: hidden;
  cursor: default;
  pointer-events: none;
}

/* =========================
   HORARIOS
   ========================= */

.hora-libre-wrap {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px;
  background: var(--color-surface);
  box-sizing: border-box;
}

.hora-libre-titulo {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 14px;
}

.hora-libre-titulo strong {
  color: var(--color-text);
}

/* =========================
   HORA DE INICIO
   ========================= */

.hora-libre {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 14px;
}

.hora-campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
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
  box-sizing: border-box;

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

  box-shadow:
    0 0 0 3px
    color-mix(
      in srgb,
      var(--color-primary) 15%,
      transparent
    );
}

.hora-sep {
  font-size: 20px;
  font-weight: 700;

  color: var(--color-text-muted);

  padding-bottom: 10px;
}

/* =========================
   HORA DE FINALIZACIÓN
   ========================= */

.campo-hora {
  display: flex;
  align-items: flex-end;
  gap: 10px;

  margin-top: 4px;
}

.campo-hora label {
  align-self: center;

  margin-right: 4px;

  font-size: 11px;
  font-weight: 600;

  text-transform: uppercase;
  letter-spacing: 0.4px;

  color: var(--color-text-muted);

  white-space: nowrap;
}

.campo-hora .hora-select {
  flex: 1;
  min-width: 0;
}

/* =========================
   ERROR
   ========================= */

.hora-error {
  margin: 8px 0 0;

  font-size: 12px;
  line-height: 1.4;

  color: #dc2626;
}

/* =========================
   VISTA PREVIA
   ========================= */

.hora-libre-preview {
  margin: 12px 0 0;

  font-size: 13px;
  color: var(--color-text-secondary);
}

.hora-libre-preview strong {
  color: var(--color-primary);
}

/* =========================
   RESPONSIVE
   ========================= */

@media (max-width: 640px) {

  .calendario {
    padding: 10px;
  }

  .cal-btn {
    width: 36px;
    height: 36px;
  }

  .calendario-semana,
  .calendario-dias {
    gap: 3px;
  }

  .calendario-semana span {
    font-size: 9px;
  }

  .cal-dia {
    font-size: 12px;
  }

  .hora-libre {
    flex-direction: column;
    align-items: stretch;
  }

  .hora-sep {
    display: none;
  }

  .campo-hora {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .campo-hora label {
    grid-column: 1 / -1;
  }

  .hora-libre-preview {
    word-break: break-word;
  }
}

@media (max-width: 380px) {

  .calendario {
    padding: 8px;
  }

  .calendario-semana span {
    font-size: 8px;
  }

  .cal-dia {
    font-size: 11px;
  }

  .hora-libre-wrap {
    padding: 10px;
  }
}

</style>