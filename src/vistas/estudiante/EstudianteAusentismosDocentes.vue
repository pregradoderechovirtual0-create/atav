<script setup lang="ts">
import { computed, ref } from "vue";
import { useNotificaciones } from "@/composables/useNotificaciones";
import type { NotificacionData } from "@/lib/dominio/notificaciones";
import {
  labelTipoAusentismo,
  labelTipoReprogramacion,
} from "@/lib/solicitudes/docenteSolicitudes";

const { notificaciones, loading: cargando, marcarLeida } = useNotificaciones();
const busqueda = ref("");
const filtroActivo = ref<"todos" | "no-leidos">("todos");
const nombreEstudiante = ref(localStorage.getItem("nombre")?.split(" ")[0] || "estudiante");

const avisos = computed(() => notificaciones.value.filter(
  (notificacion) => notificacion.tipo === "inasistencia_docente",
));

const avisosFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLocaleLowerCase();
  return avisos.value.filter((aviso) => {
    const coincideTexto = !texto || [aviso.titulo, aviso.mensaje, aviso.materiaCodigo]
      .some((valor) => valor.toLocaleLowerCase().includes(texto));
    const coincideFiltro = filtroActivo.value === "todos"
      || (filtroActivo.value === "no-leidos" && !aviso.leida);
    return coincideTexto && coincideFiltro;
  });
});

const filtros = computed(() => [
  { id: "todos" as const, label: "Todos", count: avisos.value.length },
  { id: "no-leidos" as const, label: "No leídos", count: avisos.value.filter((aviso) => !aviso.leida).length },
]);

const formatFecha = (fecha: string) => {
  if (!fecha) return "Fecha no disponible";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
};

const formatRango = (inicio: string, fin: string) => {
  if (!inicio) return "Fecha no disponible";
  if (!fin || inicio === fin) return formatFecha(inicio);
  return `${formatFecha(inicio)} al ${formatFecha(fin)}`;
};

const abrirAviso = async (aviso: NotificacionData) => {
  await marcarLeida(aviso.id);
};

const marcarAvisosLeidos = async () => {
  await Promise.all(
    avisos.value
      .filter((aviso) => !aviso.leida)
      .map((aviso) => marcarLeida(aviso.id)),
  );
};

</script>

<template>
  <div class="ausentismos-page">
    <div class="section-heading">
      <div>
        <p class="saludo">Hola, {{ nombreEstudiante }}</p>
        <h1>Ausentismos docentes</h1>
        <p>Consulta las novedades de tus encuentros sincrónicos. Aquí encontrarás las solicitudes aprobadas por coordinación académica.</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card-total"><span>Total de avisos</span><strong>{{ avisos.length }}</strong><small>Este periodo</small></div>
      <div class="stat-card stat-card-unread"><span>Sin leer</span><strong>{{ filtros[1].count }}</strong><small>Requieren tu atención</small></div>
    </div>

    <section class="avisos-panel">
      <div class="panel-heading">
        <div><h2>Avisos recientes</h2><p>Solicitudes aprobadas de tus docentes</p></div>
        <div class="panel-tools">
          <label class="search-box">
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input v-model="busqueda" type="search" placeholder="Buscar aviso..." aria-label="Buscar aviso" />
          </label>
          <button type="button" class="mark-all" :disabled="!filtros[1].count" @click="marcarAvisosLeidos">Marcar todo como leído</button>
        </div>
      </div>
      <div class="filter-tabs">
        <button v-for="filtro in filtros" :key="filtro.id" type="button" :class="{ active: filtroActivo === filtro.id }" @click="filtroActivo = filtro.id">
          {{ filtro.label }} ({{ filtro.count }})
        </button>
      </div>

    <div v-if="cargando" class="loading-state">
      <div class="spinner" />
      <span>Cargando ausentismos...</span>
    </div>

    <div v-else-if="!avisosFiltrados.length" class="empty-state">
      <p>{{ avisos.length ? "No hay avisos que coincidan con tu filtro." : "No tienes avisos de ausentismos docentes." }}</p>
    </div>

    <div v-else class="avisos-list">
      <article v-for="aviso in avisosFiltrados" :key="aviso.id" :class="['aviso-card', { 'aviso-no-leido': !aviso.leida }]" @click="abrirAviso(aviso)">
        <div class="aviso-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M8 2v4M16 2v4M3 10h18" />
          </svg>
        </div>
        <div class="aviso-info">
          <div class="aviso-title-row"><h3>{{ aviso.titulo }}</h3><span v-if="!aviso.leida" class="nuevo">Nuevo</span></div>
          <p class="aviso-mensaje">{{ aviso.mensaje }}</p>
          <p v-if="aviso.docenteNombre" class="aviso-meta">Docente: {{ aviso.docenteNombre }}</p>
          <p v-if="aviso.tipoAusentismo" class="aviso-meta">Motivo: {{ labelTipoAusentismo(aviso.tipoAusentismo) }}</p>
          <p v-if="aviso.fechaInicio" class="aviso-meta">Encuentro: {{ formatRango(aviso.fechaInicio, aviso.fechaFin) }}</p>
          <p v-if="aviso.tipoReprogramacion" class="aviso-meta">Reprogramación: {{ labelTipoReprogramacion(aviso.tipoReprogramacion) }}</p>
          <p v-if="aviso.fechasReprogramacion.length" class="aviso-meta">Nueva fecha: {{ formatFecha(aviso.fechasReprogramacion[0]) }}</p>
          <span class="aviso-fecha">{{ aviso.fecha }}</span>
        </div>
        <span :class="['estado-aviso', { leido: aviso.leida }]">{{ aviso.leida ? "Leído" : "Sin leer" }}</span>
      </article>
    </div>
    </section>
  </div>
</template>

<style scoped>
.ausentismos-page { display: flex; flex-direction: column; gap: 24px; }
.section-heading { display: flex; justify-content: space-between; align-items: end; gap: 16px; }
.section-heading h1 { margin: 4px 0 0; color: var(--color-text); font-size: 32px; }
.section-heading p { max-width: 560px; margin: 8px 0 0; color: var(--color-text-secondary); font-size: 14px; line-height: 1.5; }
.section-heading .saludo { margin: 0; color: var(--color-text); font-size: 14px; }
.mark-all { padding: 10px 14px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: var(--color-text); cursor: pointer; white-space: nowrap; }
.stats-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.stat-card { display: flex; flex-direction: column; gap: 7px; padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); box-shadow: var(--shadow-xs); }
.stat-card span, .stat-card small { color: var(--color-text-muted); font-size: 12px; }.stat-card strong { color: var(--color-text); font-size: 28px; }.stat-card small { font-size: 11px; }
.stat-card-total { border-color: #bfd5eb; background: #f4f8fd; }.stat-card-total span { color: #285985; font-weight: 700; }.stat-card-total small { color: #4777a4; font-weight: 600; }.stat-card-total strong { color: #2f6fa3; }
.stat-card-unread { border-color: #f1c2c2; background: #fff7f7; }.stat-card-unread span { color: #a93636; font-weight: 700; }.stat-card-unread small { color: #c45353; font-weight: 600; }.stat-card-unread strong { color: #c24141; }
.avisos-panel { overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
.panel-heading { display: flex; justify-content: space-between; gap: 16px; padding: 20px; border-bottom: 1px solid var(--color-border-light); }.panel-heading h2 { margin: 0; font-size: 16px; }.panel-heading p { margin: 6px 0 0; color: var(--color-text-muted); font-size: 13px; }.panel-tools { display: flex; gap: 8px; align-items: center; }.search-box { position: relative; display: block; width: 210px; color: var(--color-accent); }.search-box svg { position: absolute; top: 50%; left: 12px; transform: translateY(-50%); pointer-events: none; }.search-box input { box-sizing: border-box; width: 100%; padding: 9px 12px 9px 40px; border: 1px solid #a9c4d8; border-radius: var(--radius); background: #fbfdff; box-shadow: 0 1px 3px rgba(30, 80, 110, 0.12); font-size: 12px; color: var(--color-text); outline: none; }.search-box input::placeholder { color: var(--color-text-secondary); font-weight: 500; }.search-box input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14); }.mark-all:disabled { opacity: .5; cursor: not-allowed; }
.filter-tabs { display: flex; gap: 20px; padding: 0 20px; border-bottom: 1px solid var(--color-border-light); }.filter-tabs button { padding: 14px 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--color-text-muted); cursor: pointer; }.filter-tabs button.active { border-color: var(--color-text); color: var(--color-text); }.filter-tabs span { margin-left: 4px; }
.empty-state { display: flex; align-items: center; justify-content: center; min-height: 150px; padding: 32px 20px 52px; text-align: center; color: #b53d3d; font-size: 14px; font-weight: 600; }
.avisos-list { display: flex; flex-direction: column; }.aviso-card { display: flex; align-items: flex-start; gap: 14px; padding: 18px 20px; border-bottom: 1px solid var(--color-border-light); cursor: pointer; }.aviso-card:last-child { border-bottom: 0; }.aviso-card:hover { background: var(--color-subtle); }.aviso-no-leido { background: var(--color-info-bg); }.aviso-icon { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex-shrink: 0; border-radius: var(--radius); background: var(--color-subtle); color: var(--color-accent); }.aviso-info { flex: 1; min-width: 0; }.aviso-title-row { display: flex; align-items: center; gap: 8px; }.aviso-title-row h3 { margin: 0; font-size: 14px; }.nuevo { padding: 3px 7px; border-radius: 999px; background: var(--color-accent); color: white; font-size: 10px; font-weight: 700; }.aviso-mensaje, .aviso-meta { margin: 5px 0 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.45; }.aviso-fecha { display: block; margin-top: 7px; color: var(--color-text-muted); font-size: 11px; }.estado-aviso { flex-shrink: 0; padding: 4px 8px; border-radius: 999px; background: var(--color-warning-bg); color: var(--color-warning); font-size: 11px; font-weight: 600; }.estado-aviso.leido { background: var(--color-subtle); color: var(--color-text-muted); }
@media (max-width: 760px) { .section-heading, .panel-heading { align-items: stretch; flex-direction: column; }.stats-grid { grid-template-columns: 1fr; }.panel-tools { flex-direction: column; align-items: stretch; }.search-box { width: 100%; }.aviso-card { padding: 16px; } }
</style>