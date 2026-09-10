<script setup lang="ts">
import { computed, ref, watch } from "vue";

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
} from "@/lib/ui/calendarioFormulario";

interface FechaReprogramacion {
  inicio: string;
  fin: string;
}

const props = defineProps<{
  modelValue: FechaReprogramacion;
  min?: string;
  max?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [FechaReprogramacion];
}>();

/* =========================================================
   ESTADO
   ========================================================= */

const fechaSel = ref("");
const horaInicio = ref("");
const minutoInicio = ref("");

const horaFin = ref("");
const minutoFin = ref("");

const calMes = ref(new Date().getMonth());
const calAnio = ref(new Date().getFullYear());

/* =========================================================
   FECHA MÍNIMA EFECTIVA
   ========================================================= */

const hoyIso = computed(() => {
  const ahora = new Date();

  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, "0");
  const day = String(ahora.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
});

const fechaMinima = computed(() => {
  const min = props.min?.split("T")[0] || "";

  if (!min) return hoyIso.value;

  return min > hoyIso.value ? min : hoyIso.value;
});

/* =========================================================
   CALENDARIO
   ========================================================= */

const diasCalendario = computed(() => {
  return construirDiasCalendario(
    calAnio.value,
    calMes.value,
    fechaMinima.value,
    props.max,
  );
});

const nombreMes = computed(() => {
  return MESES_NOMBRES[calMes.value];
});

const puedeMesAnterior = computed(() => {
  const fecha = new Date(calAnio.value, calMes.value, 1);
  const minimo = new Date(`${fechaMinima.value}T00:00:00`);

  const mesMinimo = new Date(
    minimo.getFullYear(),
    minimo.getMonth(),
    1,
  );

  return fecha > mesMinimo;
});

const puedeMesSiguiente = computed(() => {
  if (!props.max) return true;

  const fecha = new Date(
    calAnio.value,
    calMes.value,
    1,
  );

  const maxFecha = new Date(
    `${props.max.split("T")[0]}T00:00:00`,
  );

  const mesMaximo = new Date(
    maxFecha.getFullYear(),
    maxFecha.getMonth(),
    1,
  );

  return fecha < mesMaximo;
});

function mesAnterior() {
  if (!puedeMesAnterior.value) return;

  if (calMes.value === 0) {
    calMes.value = 11;
    calAnio.value--;
  } else {
    calMes.value--;
  }
}

function mesSiguiente() {
  if (!puedeMesSiguiente.value) return;

  if (calMes.value === 11) {
    calMes.value = 0;
    calAnio.value++;
  } else {
    calMes.value++;
  }
}

/* =========================================================
   HORA ACTUAL
   ========================================================= */

const horaActual = computed(() => {
  const ahora = new Date();

  const hora = String(ahora.getHours()).padStart(2, "0");
  const minuto = String(ahora.getMinutes()).padStart(2, "0");

  return `${hora}:${minuto}`;
});

const fechaEsHoy = computed(() => {
  return fechaSel.value === hoyIso.value;
});

/* =========================================================
   HORAS Y MINUTOS DE INICIO
   ========================================================= */

const todasLasHoras = computed(() => {
  return Array.from(
    { length: 24 },
    (_, i) => String(i).padStart(2, "0"),
  );
});

const todosLosMinutos = computed(() => {
  return Array.from(
    { length: 60 },
    (_, i) => String(i).padStart(2, "0"),
  );
});

const horasDisponibles = computed(() => {
  if (!fechaEsHoy.value) {
    return todasLasHoras.value;
  }

  const horaMinima = Number(horaActual.value.slice(0, 2));

  return todasLasHoras.value.filter(
    (hora) => Number(hora) >= horaMinima,
  );
});

const minutosDisponibles = computed(() => {
  if (!fechaEsHoy.value) {
    return todosLosMinutos.value;
  }

  const horaSeleccionada = Number(horaInicio.value);
  const horaMinima = Number(horaActual.value.slice(0, 2));
  const minutoMinimo = Number(horaActual.value.slice(3, 5));

  if (horaSeleccionada > horaMinima) {
    return todosLosMinutos.value;
  }

  return todosLosMinutos.value.filter(
    (minuto) => Number(minuto) >= minutoMinimo,
  );
});

/* =========================================================
   HORAS Y MINUTOS DE FINALIZACIÓN
   ========================================================= */

const horasFinDisponibles = computed(() => {
  if (!horaInicio.value) {
    return [];
  }

  const horaInicioNumero = Number(horaInicio.value);

  return todasLasHoras.value.filter(
    (hora) => Number(hora) >= horaInicioNumero,
  );
});

const minutosFinDisponibles = computed(() => {
  if (!horaInicio.value || !horaFin.value) {
    return todosLosMinutos.value;
  }

  const horaInicioNumero = Number(horaInicio.value);
  const horaFinNumero = Number(horaFin.value);

  if (horaFinNumero > horaInicioNumero) {
    return todosLosMinutos.value;
  }

  const minutoInicioNumero = Number(minutoInicio.value);

  return todosLosMinutos.value.filter(
    (minuto) => Number(minuto) > minutoInicioNumero,
  );
});

/* =========================================================
   FECHAS/HORAS COMPLETAS
   ========================================================= */

const horaInicioCompleta = computed(() => {
  if (!horaInicio.value || !minutoInicio.value) {
    return "";
  }

  return `${horaInicio.value}:${minutoInicio.value}`;
});

const horaFinCompleta = computed(() => {
  if (!horaFin.value || !minutoFin.value) {
    return "";
  }

  return `${horaFin.value}:${minutoFin.value}`;
});

/* =========================================================
   VALIDACIONES
   ========================================================= */

const horaEsValida = computed(() => {
  if (!fechaSel.value) return false;
  if (!horaInicioCompleta.value) return false;

  if (fechaEsHoy.value) {
    return horaInicioCompleta.value >= horaActual.value;
  }

  return true;
});

const finEsValido = computed(() => {
  if (!horaInicioCompleta.value) return false;
  if (!horaFinCompleta.value) return false;

  return horaFinCompleta.value > horaInicioCompleta.value;
});

const errorHora = computed(() => {
  if (!fechaSel.value) return "";

  if (!horaInicioCompleta.value) {
    return "Selecciona la hora de inicio.";
  }

  if (!horaEsValida.value) {
    return "La hora de inicio no puede ser anterior a la hora actual.";
  }

  if (!horaFinCompleta.value) {
    return "Selecciona la hora de finalización.";
  }

  if (!finEsValido.value) {
    return "La hora de finalización debe ser posterior a la hora de inicio.";
  }

  return "";
});

/* =========================================================
   SINCRONIZAR DESDE EL V-MODEL
   ========================================================= */

function sincronizarDesdeModel(
  valor: FechaReprogramacion | undefined,
) {
  const inicio = valor?.inicio || "";
  const fin = valor?.fin || "";

  if (inicio) {
    const parsedInicio = parseDatetimeLocal(inicio);

    fechaSel.value = parsedInicio.fecha;
    horaInicio.value = parsedInicio.hora;
    minutoInicio.value = parsedInicio.minuto;

    const fecha = new Date(`${parsedInicio.fecha}T00:00:00`);

    calMes.value = fecha.getMonth();
    calAnio.value = fecha.getFullYear();
  } else {
    fechaSel.value = "";
    horaInicio.value = "";
    minutoInicio.value = "";
  }

  if (fin) {
    const parsedFin = parseDatetimeLocal(fin);

    horaFin.value = parsedFin.hora;
    minutoFin.value = parsedFin.minuto;
  } else {
    horaFin.value = "";
    minutoFin.value = "";
  }
}

watch(
  () => props.modelValue,
  (valor) => {
    sincronizarDesdeModel(valor);
  },
  {
    immediate: true,
    deep: true,
  },
);

/* =========================================================
   EMITIR VALOR
   ========================================================= */

function emitirValor() {
  if (!fechaSel.value) {
    return;
  }

  if (!horaInicio.value || !minutoInicio.value) {
    return;
  }

  if (!horaFin.value || !minutoFin.value) {
    return;
  }

  const inicio = toDatetimeLocal(
    fechaSel.value,
    horaInicioCompleta.value,
  );

  const fin = toDatetimeLocal(
    fechaSel.value,
    horaFinCompleta.value,
  );

  if (!horaEsValida.value) {
    return;
  }

  if (!finEsValido.value) {
    return;
  }

  emit("update:modelValue", {
    inicio,
    fin,
  });
}

/* =========================================================
   SELECCIONAR DÍA
   ========================================================= */

function seleccionarDia(celda: CeldaCalendario) {
  if (celda.vacio) return;

  if (
    !esDiaHabilitado(
      celda.iso,
      fechaMinima.value,
      props.max,
    )
  ) {
    return;
  }

  fechaSel.value = celda.iso;

  /*
   * Al cambiar de fecha conservamos las horas si existen.
   * Si no existen, usamos valores iniciales razonables.
   */

  if (!horaInicio.value) {
    if (celda.iso === hoyIso.value) {
      const ahora = new Date();

      horaInicio.value = String(
        ahora.getHours(),
      ).padStart(2, "0");

      minutoInicio.value = String(
        ahora.getMinutes(),
      ).padStart(2, "0");
    } else {
      horaInicio.value = "08";
      minutoInicio.value = "00";
    }
  }

  if (!horaFin.value || !minutoFin.value) {
    establecerHoraFinInicial();
  }

  emitirValor();
}

/* =========================================================
   AJUSTAR HORA DE FINALIZACIÓN
   ========================================================= */

function establecerHoraFinInicial() {
  if (!horaInicio.value || !minutoInicio.value) {
    return;
  }

  const inicioHora = Number(horaInicio.value);
  const inicioMinuto = Number(minutoInicio.value);

  /*
   * Intentamos colocar la finalización un minuto
   * después del inicio.
   */

  if (inicioMinuto < 59) {
    horaFin.value = horaInicio.value;
    minutoFin.value = String(
      inicioMinuto + 1,
    ).padStart(2, "0");

    return;
  }

  /*
   * Si son XX:59, pasamos a la siguiente hora.
   */

  if (inicioHora < 23) {
    horaFin.value = String(
      inicioHora + 1,
    ).padStart(2, "0");

    minutoFin.value = "00";

    return;
  }

  /*
   * 23:59 no tiene una hora posterior
   * dentro del mismo día.
   */

  horaFin.value = "";
  minutoFin.value = "";
}

function ajustarHoraFin() {
  if (!horaInicio.value || !minutoInicio.value) {
    horaFin.value = "";
    minutoFin.value = "";
    return;
  }

  if (
    !horaFin.value ||
    !minutoFin.value
  ) {
    establecerHoraFinInicial();
    return;
  }

  const inicio = Number(
    horaInicio.value + minutoInicio.value,
  );

  const fin = Number(
    horaFin.value + minutoFin.value,
  );

  if (fin <= inicio) {
    establecerHoraFinInicial();
  }
}

/* =========================================================
   LIMPIAR
   ========================================================= */

function limpiar() {
  fechaSel.value = "";
  horaInicio.value = "";
  minutoInicio.value = "";
  horaFin.value = "";
  minutoFin.value = "";

  emit("update:modelValue", {
    inicio: "",
    fin: "",
  });
}

/* =========================================================
   CAMBIOS DE HORA
   ========================================================= */

function cambioHoraInicio() {
  /*
   * Si se cambia la hora de inicio, los minutos
   * deben seguir siendo válidos.
   */

  if (
    fechaEsHoy.value &&
    horaInicio.value === horaActual.value.slice(0, 2)
  ) {
    const minutoActual = Number(
      horaActual.value.slice(3, 5),
    );

    if (
      minutoInicio.value &&
      Number(minutoInicio.value) < minutoActual
    ) {
      minutoInicio.value = String(
        minutoActual,
      ).padStart(2, "0");
    }
  }

  ajustarHoraFin();
  emitirValor();
}

function cambioMinutoInicio() {
  ajustarHoraFin();
  emitirValor();
}

function cambioHoraFin() {
  /*
   * Si la hora final coincide con la hora inicial,
   * los minutos finales deben ser mayores.
   */

  if (
    horaFin.value === horaInicio.value &&
    minutoFin.value
  ) {
    const minutoInicioNumero = Number(
      minutoInicio.value,
    );

    if (
      Number(minutoFin.value) <=
      minutoInicioNumero
    ) {
      minutoFin.value = "";
    }
  }

  emitirValor();
}

function cambioMinutoFin() {
  emitirValor();
}
</script>

<template>
  <div class="selector-fecha-hora">
    <!-- =====================================================
         CALENDARIO
         ===================================================== -->

    <div class="cal-wrapper">
      <div class="cal-nav">
        <button
          type="button"
          class="cal-nav-btn"
          :disabled="!puedeMesAnterior"
          @click="mesAnterior"
        >
          ‹
        </button>

        <div class="cal-mes">
          {{ nombreMes }} {{ calAnio }}
        </div>

        <button
          type="button"
          class="cal-nav-btn"
          :disabled="!puedeMesSiguiente"
          @click="mesSiguiente"
        >
          ›
        </button>
      </div>

      <div class="cal-grid">
        <div
          v-for="dia in DIAS_SEMANA_CORTOS"
          :key="dia"
          class="cal-head"
        >
          {{ dia }}
        </div>

        <button
          v-for="(celda, index) in diasCalendario"
          :key="`${celda.iso || 'vacio'}-${index}`"
          type="button"
          class="cal-celda"
          :class="{
            'cal-vacio': celda.vacio,
            'cal-seleccionada':
              !celda.vacio &&
              celda.iso === fechaSel,
            'cal-deshabilitada':
              !celda.vacio &&
              !esDiaHabilitado(
                celda.iso,
                fechaMinima,
                props.max,
              ),
          }"
          :disabled="
            celda.vacio ||
            !esDiaHabilitado(
              celda.iso,
              fechaMinima,
              props.max,
            )
          "
          @click="seleccionarDia(celda)"
        >
          {{ celda.dia }}
        </button>
      </div>
    </div>

    <!-- =====================================================
         FECHA SELECCIONADA
         ===================================================== -->

    <div
      v-if="fechaSel"
      class="fecha-seleccionada"
    >
      <span class="fecha-label">
        Fecha seleccionada
      </span>

      <strong>
        {{ formatFechaLegible(fechaSel) }}
      </strong>
    </div>

    <!-- =====================================================
         HORA DE INICIO
         ===================================================== -->

    <div
      v-if="fechaSel"
      class="hora-libre-wrap"
    >
      <div class="hora-titulo">
        Hora de inicio
      </div>

      <div class="hora-libre">
        <div class="hora-campo">
          <label class="hora-campo-label">
            Hora
          </label>

          <select
            v-model="horaInicio"
            class="hora-select"
            @change="cambioHoraInicio"
          >
            <option value="" disabled>
              HH
            </option>

            <option
              v-for="hora in horasDisponibles"
              :key="hora"
              :value="hora"
            >
              {{ hora }}
            </option>
          </select>
        </div>

        <span class="hora-sep">:</span>

        <div class="hora-campo">
          <label class="hora-campo-label">
            Minutos
          </label>

          <select
            v-model="minutoInicio"
            class="hora-select"
            @change="cambioMinutoInicio"
          >
            <option value="" disabled>
              MM
            </option>

            <option
              v-for="minuto in minutosDisponibles"
              :key="minuto"
              :value="minuto"
            >
              {{ minuto }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- =====================================================
         HORA DE FINALIZACIÓN
         ===================================================== -->

    <div
      v-if="fechaSel"
      class="hora-libre-wrap"
    >
      <div class="hora-titulo">
        Hora de finalización
      </div>

      <div class="hora-libre">
        <div class="hora-campo">
          <label class="hora-campo-label">
            Hora
          </label>

          <select
            v-model="horaFin"
            class="hora-select"
            :disabled="!horaInicio"
            @change="cambioHoraFin"
          >
            <option value="" disabled>
              HH
            </option>

            <option
              v-for="hora in horasFinDisponibles"
              :key="hora"
              :value="hora"
            >
              {{ hora }}
            </option>
          </select>
        </div>

        <span class="hora-sep">:</span>

        <div class="hora-campo">
          <label class="hora-campo-label">
            Minutos
          </label>

          <select
            v-model="minutoFin"
            class="hora-select"
            :disabled="!horaFin"
            @change="cambioMinutoFin"
          >
            <option value="" disabled>
              MM
            </option>

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
    </div>

    <!-- =====================================================
         ERROR DE HORA
         ===================================================== -->

    <div
      v-if="errorHora"
      class="hora-error"
    >
      {{ errorHora }}
    </div>

    <!-- =====================================================
         RESUMEN
         ===================================================== -->

    <div
      v-if="
        modelValue?.inicio &&
        modelValue?.fin
      "
      class="hora-resumen"
    >
      <span>
        {{ formatFechaLegible(fechaSel) }}
      </span>

      <strong>
        {{ formatHoraLegible(modelValue.inicio) }}
        -
        {{ formatHoraLegible(modelValue.fin) }}
      </strong>
    </div>

    <!-- =====================================================
         LIMPIAR
         ===================================================== -->

    <button
      v-if="fechaSel"
      type="button"
      class="btn-limpiar"
      @click="limpiar"
    >
      Limpiar selección
    </button>
  </div>
</template>

<style scoped>
.selector-fecha-hora {
  width: 100%;
}

/* =========================================================
   CALENDARIO
   ========================================================= */

.cal-wrapper {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
  box-sizing: border-box;
}

.cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.cal-nav-btn {
  width: 34px;
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}

.cal-nav-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.cal-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cal-mes {
  font-weight: 600;
  text-transform: capitalize;
  font-size: 15px;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
}

.cal-head {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  padding: 6px 0;
}

.cal-celda {
  min-width: 0;
  aspect-ratio: 1;
  border: 0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cal-celda:hover:not(:disabled) {
  background: #f3f4f6;
}

.cal-celda.cal-seleccionada {
  background: #2563eb;
  color: white;
  font-weight: 600;
}

.cal-celda.cal-deshabilitada {
  color: #c4c7cc;
  cursor: not-allowed;
  background: #fafafa;
}

.cal-celda.cal-vacio {
  cursor: default;
  pointer-events: none;
}

/* =========================================================
   FECHA SELECCIONADA
   ========================================================= */

.fecha-seleccionada {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
}

.fecha-label {
  font-size: 12px;
  color: #6b7280;
}

/* =========================================================
   HORAS
   ========================================================= */

.hora-libre-wrap {
  margin-top: 16px;
}

.hora-titulo {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.hora-libre {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.hora-campo {
  flex: 1;
  min-width: 0;
}

.hora-campo-label {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  color: #6b7280;
}

.hora-select {
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  box-sizing: border-box;
  cursor: pointer;
}

.hora-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.hora-select:disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

.hora-sep {
  font-size: 20px;
  font-weight: 600;
  line-height: 40px;
  color: #374151;
}

/* =========================================================
   ERROR
   ========================================================= */

.hora-error {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 7px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
}

/* =========================================================
   RESUMEN
   ========================================================= */

.hora-resumen {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 11px 12px;
  border-radius: 8px;
  background: #f0fdf4;
  color: #166534;
  font-size: 13px;
}

.hora-resumen strong {
  white-space: nowrap;
}

/* =========================================================
   LIMPIAR
   ========================================================= */

.btn-limpiar {
  margin-top: 10px;
  padding: 7px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
}

.btn-limpiar:hover {
  background: #f3f4f6;
  color: #374151;
}

/* =========================================================
   RESPONSIVE
   ========================================================= */

@media (max-width: 480px) {
  .cal-wrapper {
    padding: 10px;
  }

  .cal-grid {
    gap: 3px;
  }

  .cal-celda {
    font-size: 12px;
  }

  .hora-libre {
    gap: 6px;
  }

  .hora-select {
    padding: 0 7px;
  }

  .hora-resumen {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>