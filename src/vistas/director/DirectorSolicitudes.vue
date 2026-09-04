<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from "vue";
import { db } from "@/lib/firebase";
import {
  updateDoc,
  doc,
  deleteDoc,
  arrayUnion,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import {
  crearNotificacion,
  rutaNotificacionEstudiante,
} from "@/lib/dominio/notificaciones";

import {
  formatFechaParcial,
  formatHoraParcial,
} from "@/lib/dominio/flexibilidadCatalogo";

import { fetchMaterias, type MateriaRegistrada } from "@/lib/dominio/materias";

import {
  subscribeSolicitudesDirector,
  type SolicitudDirector,
} from "@/lib/director/directorSolicitudesAggregate";

import {
  labelTipoReprogramacion,
  labelTipoAusentismo,
  formatFechaISO,
  formatFechaHoraSolicitud,
} from "@/lib/solicitudes/docenteSolicitudes";

import { dialog } from "@/lib/nucleo/dialog";

/* =========================================================
   ESTADO PRINCIPAL
   ========================================================= */

const solicitudes = ref<SolicitudDirector[]>([]);
const materiasRegistradas = ref<MateriaRegistrada[]>([]);
const loading = ref(true);

const busqueda = ref("");
const activeFilter = ref("todos");

/* =========================================================
   MODAL VER SOLICITUD
   ========================================================= */

const modalVerVisible = ref(false);
const solicitudSeleccionada = ref<any>(null);

/* =========================================================
   MODAL CONFIRMAR ACCIÓN
   ========================================================= */

const modalConfirmVisible = ref(false);
const accionPendiente = ref<"aprobar" | "rechazar" | null>(null);
const solicitudAccion = ref<any>(null);

const motivoRechazo = ref("");
const mensajeAprobacion = ref("");
const errorMotivoRechazo = ref(false);
const confirmandoAccion = ref(false);

/* =========================================================
   SELECCIÓN DE FECHA DE REPROGRAMACIÓN
   ========================================================= */

const fechaReproSeleccionada = ref<string>("");
const errorFechaRepro = ref(false);

/* =========================================================
   TOAST
   ========================================================= */

const toastVisible = ref(false);
const toastMensaje = ref("");

let toastTimeout: ReturnType<typeof setTimeout>;

/* =========================================================
   FILTROS
   ========================================================= */

const filtros = [
  { id: "todos", label: "Todas" },
  { id: "Pendiente", label: "Pendientes" },
  { id: "Aprobada", label: "Aprobadas" },
  { id: "Rechazada", label: "Rechazadas" },
];

/* =========================================================
   LABELS
   ========================================================= */

const tipoLabel: Record<string, string> = {
  flexibilizacion: "Parcial de flexibilización",
  supletorio: "Supletorio",
  habilitacion: "Habilitación",
  inasistencia: "Inasistencia docente",
};

/* =========================================================
   CARGAR SOLICITUDES
   ========================================================= */

const cargarSolicitudes = async () => {
  try {
    materiasRegistradas.value = await fetchMaterias();
  } catch (e) {
    console.error("Error cargando materias:", e);
  }
};

let unsubSolicitudes: (() => void) | null = null;

/* =========================================================
   MOUNT / UNMOUNT
   ========================================================= */

onMounted(async () => {
  await cargarSolicitudes();

  loading.value = true;

  unsubSolicitudes = subscribeSolicitudesDirector(
    materiasRegistradas.value,
    (lista) => {
      solicitudes.value = lista;
      loading.value = false;
    },
    (err) => {
      console.error("Error suscribiendo solicitudes:", err);
      loading.value = false;
    },
  );
});

onUnmounted(() => {
  unsubSolicitudes?.();
  unsubSolicitudes = null;

  clearTimeout(toastTimeout);
});

/* =========================================================
   SOLICITUDES FILTRADAS
   ========================================================= */

const solicitudesFiltradas = computed(() => {
  let lista = solicitudes.value;

  if (activeFilter.value !== "todos") {
    lista = lista.filter((s) => s.estado === activeFilter.value);
  }

  if (busqueda.value.trim()) {
    const texto = busqueda.value.toLowerCase();

    lista = lista.filter(
      (s) =>
        s.nombre?.toLowerCase().includes(texto) ||
        s.materia?.toLowerCase().includes(texto) ||
        s.motivo?.toLowerCase().includes(texto),
    );
  }

  return lista;
});

const pendientesCount = computed(
  () => solicitudes.value.filter((s) => s.estado === "Pendiente").length,
);

/* =========================================================
   FECHAS DE REPROGRAMACIÓN
   ========================================================= */

const fechasReprogramacionLista = (
  sol: SolicitudDirector | any | null | undefined,
) =>
  (sol?.fechas_reprogramacion || []).filter(
    (fecha: unknown): fecha is string =>
      typeof fecha === "string" && Boolean(fecha),
  );

/* =========================================================
   MODAL DE DETALLE
   ========================================================= */

const verSolicitud = (sol: any) => {
  solicitudSeleccionada.value = sol;

  /*
   * Si la solicitud ya tiene una fecha seleccionada,
   * la mostramos como seleccionada.
   *
   * Si tiene una sola fecha propuesta y todavía está
   * pendiente, la seleccionamos automáticamente.
   *
   * Si tiene varias fechas, dejamos que el usuario elija.
   */
  const fechas = fechasReprogramacionLista(sol);

  if (sol.tipo === "inasistencia" && sol.estado === "Pendiente") {
    if (sol.fecha_reprogramacion_seleccionada) {
      fechaReproSeleccionada.value = sol.fecha_reprogramacion_seleccionada;
    } else if (fechas.length === 1) {
      fechaReproSeleccionada.value = fechas[0];
    } else {
      fechaReproSeleccionada.value = "";
    }
  } else {
    fechaReproSeleccionada.value = sol.fecha_reprogramacion_seleccionada || "";
  }

  errorFechaRepro.value = false;
  modalVerVisible.value = true;
};

/* =========================================================
   SELECCIONAR FECHA DESDE EL MODAL DE DETALLE
   ========================================================= */

const seleccionarFechaReprogramacion = (fecha: string) => {
  if (!solicitudSeleccionada.value) return;

  /*
   * Solo permitimos cambiar la fecha mientras
   * la solicitud esté pendiente.
   */
  if (solicitudSeleccionada.value.estado !== "Pendiente") {
    return;
  }

  fechaReproSeleccionada.value = fecha;
  errorFechaRepro.value = false;
};

/* =========================================================
   REQUIERE SELECCIÓN DE FECHA
   ========================================================= */

const requiereSeleccionFecha = computed(() => {
  if (accionPendiente.value !== "aprobar") {
    return false;
  }

  if (solicitudAccion.value?.tipo !== "inasistencia") {
    return false;
  }

  return fechasReprogramacionLista(solicitudAccion.value).length > 1;
});

/* =========================================================
   PEDIR CONFIRMACIÓN
   ========================================================= */

const pedirConfirmacion = (sol: any, accion: "aprobar" | "rechazar") => {
  /*
   * Guardamos primero la selección realizada en el modal
   * de detalle para no perderla.
   */
  const seleccionActual = fechaReproSeleccionada.value;

  solicitudAccion.value = sol;
  accionPendiente.value = accion;

  motivoRechazo.value = "";
  mensajeAprobacion.value = "";
  errorMotivoRechazo.value = false;
  errorFechaRepro.value = false;

  const fechas = fechasReprogramacionLista(sol);

  if (accion === "aprobar" && sol.tipo === "inasistencia") {
    /*
     * Prioridad:
     *
     * 1. Fecha seleccionada actualmente.
     * 2. Fecha previamente guardada en Firestore.
     * 3. Si solo existe una opción, se selecciona automáticamente.
     * 4. Si existen varias, queda vacío.
     */
    if (seleccionActual && fechas.includes(seleccionActual)) {
      fechaReproSeleccionada.value = seleccionActual;
    } else if (
      sol.fecha_reprogramacion_seleccionada &&
      fechas.includes(sol.fecha_reprogramacion_seleccionada)
    ) {
      fechaReproSeleccionada.value = sol.fecha_reprogramacion_seleccionada;
    } else if (fechas.length === 1) {
      fechaReproSeleccionada.value = fechas[0];
    } else {
      fechaReproSeleccionada.value = "";
    }
  } else {
    fechaReproSeleccionada.value = "";
  }

  modalConfirmVisible.value = true;
};

/* =========================================================
   INTENTAR CONFIRMAR
   ========================================================= */

const intentarConfirmar = () => {
  if (accionPendiente.value === "rechazar" && !motivoRechazo.value.trim()) {
    errorMotivoRechazo.value = true;
    return;
  }

  if (requiereSeleccionFecha.value && !fechaReproSeleccionada.value) {
    errorFechaRepro.value = true;
    return;
  }

  errorMotivoRechazo.value = false;
  errorFechaRepro.value = false;

  confirmarAccion();
};

/* =========================================================
   CONFIRMAR ACCIÓN
   ========================================================= */

const confirmarAccion = async () => {
  if (!solicitudAccion.value || !accionPendiente.value) {
    return;
  }

  /* Validación adicional */
  if (accionPendiente.value === "rechazar" && !motivoRechazo.value.trim()) {
    errorMotivoRechazo.value = true;
    return;
  }

  if (requiereSeleccionFecha.value && !fechaReproSeleccionada.value) {
    errorFechaRepro.value = true;
    return;
  }

  confirmandoAccion.value = true;

  const nuevoEstado =
    accionPendiente.value === "aprobar" ? "Aprobada" : "Rechazada";

  const coleccion = solicitudAccion.value.coleccion || "solicitudes";

  const estadoGuardar = nuevoEstado.toLowerCase();

  try {
    /* =====================================================
       1. ACTUALIZAR FIRESTORE
       ===================================================== */

    const payload: Record<string, unknown> = {
      estado: estadoGuardar,
      actualizado_en: serverTimestamp(),

      historial: arrayUnion({
        accion: accionPendiente.value,
        estado: estadoGuardar,
        en: new Date().toISOString(),

        ...(accionPendiente.value === "rechazar"
          ? {
              motivo: motivoRechazo.value.trim(),
            }
          : {}),

        ...(accionPendiente.value === "aprobar" && fechaReproSeleccionada.value
          ? {
              fecha_reprogramacion_seleccionada: fechaReproSeleccionada.value,
            }
          : {}),
      }),
    };

    /* Motivo de rechazo */
    if (accionPendiente.value === "rechazar") {
      payload.motivo_rechazo = motivoRechazo.value.trim();
    }

    /* Fecha definitiva */
    if (accionPendiente.value === "aprobar" && fechaReproSeleccionada.value) {
      payload.fecha_reprogramacion_seleccionada = fechaReproSeleccionada.value;
    }

    await updateDoc(doc(db, coleccion, solicitudAccion.value.id), payload);

    /* =====================================================
       2. ACTUALIZAR ARRAY LOCAL
       ===================================================== */

    const idx = solicitudes.value.findIndex(
      (s) => s.id === solicitudAccion.value.id,
    );

    if (idx !== -1) {
      solicitudes.value[idx].estado = nuevoEstado;

      if (accionPendiente.value === "rechazar") {
        solicitudes.value[idx].motivo_rechazo = motivoRechazo.value.trim();
      }

      if (accionPendiente.value === "aprobar" && fechaReproSeleccionada.value) {
        (solicitudes.value[idx] as any).fecha_reprogramacion_seleccionada =
          fechaReproSeleccionada.value;
      }
    }

    /* =====================================================
       3. ACTUALIZAR SOLICITUD SELECCIONADA
       ===================================================== */

    if (
      solicitudSeleccionada.value &&
      solicitudSeleccionada.value.id === solicitudAccion.value.id
    ) {
      solicitudSeleccionada.value.estado = nuevoEstado;

      if (accionPendiente.value === "aprobar" && fechaReproSeleccionada.value) {
        solicitudSeleccionada.value.fecha_reprogramacion_seleccionada =
          fechaReproSeleccionada.value;
      }

      if (accionPendiente.value === "rechazar") {
        solicitudSeleccionada.value.motivo_rechazo = motivoRechazo.value.trim();
      }
    }

    /* =====================================================
       4. NOTIFICAR SOLICITANTE
       ===================================================== */

    const destinatario =
      solicitudAccion.value.estudiante_id ||
      solicitudAccion.value.docente_id ||
      solicitudAccion.value.usuario_id;

    if (destinatario) {
      const esAprobada = accionPendiente.value === "aprobar";

      const tipoSolicitud =
        tipoLabel[solicitudAccion.value.tipo] || "Solicitud";

      const esEstudiante = Boolean(solicitudAccion.value.estudiante_id);

      const ruta = esEstudiante
        ? rutaNotificacionEstudiante(solicitudAccion.value.tipo)
        : "/docente/mis-solicitudes";

      try {
        let mensajeNotificacion = "";

        if (esAprobada) {
          mensajeNotificacion = `Tu solicitud de ${tipoSolicitud.toLowerCase()} para la materia ${solicitudAccion.value.materia} fue aprobada por la Dirección del Programa.`;

          if (
            solicitudAccion.value.tipo === "inasistencia" &&
            fechaReproSeleccionada.value
          ) {
            mensajeNotificacion += `\n\nLa fecha de reprogramación seleccionada es: ${formatFechaHoraSolicitud(
              fechaReproSeleccionada.value,
            )}.`;
          }

          if (mensajeAprobacion.value.trim()) {
            mensajeNotificacion += `\n\nMensaje adicional:\n${mensajeAprobacion.value.trim()}`;
          }
        } else {
          mensajeNotificacion = `Tu solicitud de ${tipoSolicitud.toLowerCase()} para la materia ${solicitudAccion.value.materia} fue rechazada.\n\nMotivo: ${motivoRechazo.value}`;
        }

        await crearNotificacion({
          usuario_id: destinatario,
          titulo: esAprobada ? "Solicitud aprobada" : "Solicitud rechazada",
          mensaje: mensajeNotificacion,
          tipo: esAprobada ? "success" : "error",
          ruta,
        });
      } catch (error) {
        console.error("Error al crear la notificación:", error);
      }
    }

    /* =====================================================
       5. NOTIFICAR ESTUDIANTES
       ===================================================== */

    if (
      accionPendiente.value === "aprobar" &&
      solicitudAccion.value.tipo === "inasistencia"
    ) {
      try {
        const docenteSolicitud = normalizarNombre(
          solicitudAccion.value.docente_nombre || solicitudAccion.value.nombre,
        );
        const estudiantes = await getDocs(
          query(
            collection(db, "suscripciones_materias"),
            where("materia_codigo", "==", solicitudAccion.value.materia_codigo),
          ),
        );

        const estudiantesDeLaClase = estudiantes.docs.filter(
          (docEstudiante: { data: () => Record<string, unknown> }) => {
            const estudiante = docEstudiante.data();
            return normalizarNombre(estudiante.profesor) === docenteSolicitud;
          },
        );

        if (estudiantesDeLaClase.length) {
          await Promise.all(
            estudiantesDeLaClase.map(
              (docEstudiante: { data: () => Record<string, unknown> }) => {
                const estudiante = docEstudiante.data();

                return crearNotificacion({
                  usuario_id: estudiante.estudiante_id,
                  titulo: "Cambio en la programación de clase",
                  mensaje: `El docente ${solicitudAccion.value.docente_nombre || ""} tiene una inasistencia aprobada para la materia ${solicitudAccion.value.materia}. Revisa ATAV para consultar la nueva programación.`,
                  tipo: "info",
                  ruta: "/estudiante/calendario",
                  materia_codigo: solicitudAccion.value.materia_codigo,
                });
              },
            ),
          );
        }
      } catch (error) {
        console.error("Error notificando estudiantes:", error);
      }
    }

    mostrarToast(`Solicitud ${nuevoEstado.toLowerCase()} correctamente`);
  } catch (e) {
    console.error("Error procesando solicitud:", e);

    mostrarToast("No se pudo procesar la solicitud");
  } finally {
    confirmandoAccion.value = false;

    modalConfirmVisible.value = false;

    solicitudAccion.value = null;
    accionPendiente.value = null;

    motivoRechazo.value = "";
    mensajeAprobacion.value = "";

    errorMotivoRechazo.value = false;
    errorFechaRepro.value = false;

    /*
     * No limpiamos fechaReproSeleccionada aquí inmediatamente
     * porque puede seguir siendo necesaria para mostrar
     * correctamente la solicitud seleccionada.
     */
    if (!solicitudSeleccionada.value) {
      fechaReproSeleccionada.value = "";
    }
  }
};

/* =========================================================
   CANCELAR ACCIÓN
   ========================================================= */

const cancelarAccion = () => {
  modalConfirmVisible.value = false;

  solicitudAccion.value = null;
  accionPendiente.value = null;

  motivoRechazo.value = "";
  mensajeAprobacion.value = "";

  errorMotivoRechazo.value = false;
  errorFechaRepro.value = false;

  /*
   * No limpiamos la fecha para conservar la selección
   * que pudo haber hecho el usuario desde el modal de detalle.
   */
};

/* =========================================================
   CERRAR MODAL DE DETALLE
   ========================================================= */

const cerrarModalDetalle = () => {
  modalVerVisible.value = false;
};

/* =========================================================
   ELIMINAR SOLICITUD
   ========================================================= */

const eliminarSolicitud = async (sol: any) => {
  const tipo = tipoLabel[sol.tipo] || sol.tipo || "Solicitud";

  const ok = await dialog.confirm(
    `¿Eliminar la solicitud de ${
      sol.nombre || "este usuario"
    } (${tipo})? Esta acción no se puede deshacer.`,
    {
      title: "Eliminar solicitud",
      variant: "danger",
      confirmText: "Eliminar",
    },
  );

  if (!ok) return;

  const coleccion = sol.coleccion || "solicitudes";

  try {
    await deleteDoc(doc(db, coleccion, sol.id));

    solicitudes.value = solicitudes.value.filter((s) => s.id !== sol.id);

    if (solicitudSeleccionada.value?.id === sol.id) {
      solicitudSeleccionada.value = null;
      modalVerVisible.value = false;
    }

    mostrarToast("Solicitud eliminada correctamente");
  } catch (e) {
    console.error(e);

    await dialog.alert("No se pudo eliminar la solicitud.", {
      variant: "error",
    });
  }
};

/* =========================================================
   TOAST
   ========================================================= */

const mostrarToast = (mensaje: string) => {
  toastMensaje.value = mensaje;
  toastVisible.value = true;

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toastVisible.value = false;
  }, 3000);
};

/* =========================================================
   UTILIDADES
   ========================================================= */

const badgeEstado = (estado: string) => {
  const map: Record<string, string> = {
    Pendiente: "badge-pendiente",
    Aprobada: "badge-aprobada",
    Rechazada: "badge-rechazada",
  };

  return map[estado] || "";
};

const formatFecha = (ts: any) => {
  if (!ts) return "—";

  if (ts.toDate) {
    return ts.toDate().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return ts;
};

const inicialesNombre = (nombre: string) => {
  if (!nombre) return "?";

  return nombre
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();
};

const normalizarNombre = (nombre: unknown) =>
  String(nombre || "")
    .trim()
    .toLocaleLowerCase("es-CO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
</script>

<template>
  <div class="solicitudes-page">
    <!-- =====================================================
         HEADER
         ===================================================== -->

    <div class="page-header">
      <div v-if="pendientesCount > 0" class="pending-pill">
        <span class="pending-dot" />

        {{ pendientesCount }}
        pendiente{{ pendientesCount !== 1 ? "s" : "" }}
      </div>
    </div>

    <!-- =====================================================
         TOOLBAR
         ===================================================== -->

    <div class="toolbar">
      <div class="filter-tabs">
        <button
          v-for="filtro in filtros"
          :key="filtro.id"
          :class="[
            'filter-tab',
            {
              active: activeFilter === filtro.id,
            },
          ]"
          @click="activeFilter = filtro.id"
        >
          {{ filtro.label }}
        </button>
      </div>

      <div class="search-wrapper">
        <svg
          class="search-icon"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />

          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          v-model="busqueda"
          class="search-input"
          placeholder="Buscar por nombre, materia o motivo..."
        />

        <button v-if="busqueda" class="search-clear" @click="busqueda = ''">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18" />

            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- =====================================================
         LOADING
         ===================================================== -->

    <div v-if="loading" class="loading-state">
      <div class="spinner" />

      <span> Cargando solicitudes... </span>
    </div>

    <!-- =====================================================
         LISTADO
         ===================================================== -->

    <div v-else class="card">
      <div v-if="solicitudesFiltradas.length === 0" class="empty-state">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
          />

          <polyline points="14 2 14 8 20 8" />
        </svg>

        <p>No se encontraron solicitudes</p>
      </div>

      <div v-else class="requests-list">
        <div
          v-for="sol in solicitudesFiltradas"
          :key="sol.id"
          class="request-item"
        >
          <div class="request-main">
            <div class="request-avatar">
              {{ inicialesNombre(sol.nombre) }}
            </div>

            <div class="request-info">
              <div class="request-top">
                <span class="request-name">
                  {{ sol.nombre }}
                </span>

                <span :class="['status-badge', badgeEstado(sol.estado)]">
                  {{ sol.estado }}
                </span>
              </div>

              <div class="request-details">
                <span class="tipo-tag">
                  {{ tipoLabel[sol.tipo] ?? sol.tipo }}
                </span>

                <span class="separator"> · </span>

                <span>
                  {{ sol.materia ?? "—" }}
                </span>

                <span class="separator"> · </span>

                <span>
                  {{ formatFecha(sol.creadoEn) }}
                </span>
              </div>

              <p class="request-motivo">
                {{ sol.motivo }}
              </p>
            </div>
          </div>

          <div class="request-actions">
            <!-- VER -->
            <button class="action-btn view" @click="verSolicitud(sol)">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />

                <circle cx="12" cy="12" r="3" />
              </svg>

              Ver
            </button>

            <!-- APROBAR -->
            <button
              v-if="sol.estado === 'Pendiente'"
              class="action-btn approve"
              @click="pedirConfirmacion(sol, 'aprobar')"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>

              Aprobar
            </button>

            <!-- RECHAZAR -->
            <button
              v-if="sol.estado === 'Pendiente'"
              class="action-btn reject"
              @click="pedirConfirmacion(sol, 'rechazar')"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />

                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>

              Rechazar
            </button>

            <!-- ELIMINAR -->
            <button
              v-if="sol.estado !== 'Pendiente'"
              class="action-btn delete"
              @click="eliminarSolicitud(sol)"
              title="Eliminar"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="3 6 5 6 21 6" />

                <path d="M19 6l-1 14H6L5 6" />

                <path d="M10 11v6M14 11v6" />

                <path d="M9 6V4h6v2" />
              </svg>

              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- =====================================================
         PAGINACIÓN
         ===================================================== -->

    <div class="pagination">
      <span class="pagination-info">
        {{ solicitudesFiltradas.length }}
        solicitudes
      </span>
    </div>

    <!-- =====================================================
         MODAL VER SOLICITUD
         ===================================================== -->

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="modalVerVisible"
          class="modal-overlay"
          @click.self="cerrarModalDetalle"
        >
          <div class="modal-card modal-card--detail">
            <!-- HEADER -->
            <div class="modal-header modal-header--detail">
              <div v-if="solicitudSeleccionada" class="detail-hero">
                <div class="detail-hero-avatar">
                  {{ inicialesNombre(solicitudSeleccionada.nombre) }}
                </div>

                <div class="detail-hero-info">
                  <h2 class="modal-title">
                    {{ solicitudSeleccionada.nombre }}
                  </h2>

                  <p class="modal-subtitle">
                    {{
                      tipoLabel[solicitudSeleccionada.tipo] ??
                      solicitudSeleccionada.tipo
                    }}

                    · Cédula
                    {{ solicitudSeleccionada.cedula ?? "—" }}
                  </p>

                  <div class="detail-hero-badges">
                    <span
                      :class="[
                        'status-badge',
                        badgeEstado(solicitudSeleccionada.estado),
                      ]"
                    >
                      {{ solicitudSeleccionada.estado }}
                    </span>

                    <span class="detail-meta-chip">
                      Solicitud del
                      {{ formatFecha(solicitudSeleccionada.creadoEn) }}
                    </span>
                  </div>
                </div>
              </div>

              <button class="modal-close" @click="cerrarModalDetalle">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />

                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div class="modal-divider" />

            <!-- BODY -->
            <div
              v-if="solicitudSeleccionada"
              class="modal-body modal-body--detail"
            >
              <!-- =================================================
                   DATOS DEL SOLICITANTE
                   ================================================= -->

              <section class="detail-section">
                <div class="detail-section-head">
                  <h3 class="detail-section-title">Datos del solicitante</h3>
                </div>

                <div class="detail-grid detail-grid--3">
                  <div class="detail-item">
                    <span class="detail-label"> Nombre completo </span>

                    <span class="detail-value">
                      {{ solicitudSeleccionada.nombre }}
                    </span>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label"> Cédula </span>

                    <span class="detail-value">
                      {{ solicitudSeleccionada.cedula ?? "—" }}
                    </span>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label"> Fecha de solicitud </span>

                    <span class="detail-value">
                      {{ formatFecha(solicitudSeleccionada.creadoEn) }}
                    </span>
                  </div>
                </div>
              </section>

              <!-- =================================================
                   FLEXIBILIZACIÓN
                   ================================================= -->

              <section
                v-if="solicitudSeleccionada.tipo === 'flexibilizacion'"
                class="detail-section"
              >
                <div class="detail-section-head">
                  <h3 class="detail-section-title">
                    Flexibilización de parcial
                  </h3>
                </div>

                <div class="detail-grid detail-grid--3">
                  <div class="detail-item">
                    <span class="detail-label"> Parcial </span>

                    <span class="detail-value detail-value--highlight">
                      Parcial
                      {{ solicitudSeleccionada.parcial ?? "—" }}
                    </span>
                  </div>

                  <div class="detail-item detail-item--wide">
                    <span class="detail-label"> Materia </span>

                    <span class="detail-value">
                      {{ solicitudSeleccionada.materia ?? "—" }}
                    </span>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label"> Fecha solicitada </span>

                    <span class="detail-value">
                      {{
                        formatFechaParcial(solicitudSeleccionada.fechaParcial)
                      }}
                    </span>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label"> Hora solicitada </span>

                    <span class="detail-value">
                      {{ formatHoraParcial(solicitudSeleccionada.horaParcial) }}
                    </span>
                  </div>
                </div>
              </section>

              <!-- =================================================
                   PERIODO DE AUSENCIA
                   ================================================= -->

              <section
                v-if="solicitudSeleccionada.tipo === 'inasistencia'"
                class="detail-section"
              >
                <div class="detail-section-head">
                  <h3 class="detail-section-title">Periodo de ausencia</h3>
                </div>

                <div class="detail-grid detail-grid--3">
                  <div class="detail-item">
                    <span class="detail-label"> Tipo de ausentismo </span>

                    <span class="detail-value">
                      {{
                        labelTipoAusentismo(
                          solicitudSeleccionada.tipo_ausentismo || "",
                        ) || "—"
                      }}
                    </span>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label"> Fecha de inicio </span>

                    <span class="detail-value">
                      {{
                        formatFechaISO(solicitudSeleccionada.fecha_inicio || "")
                      }}
                    </span>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label"> Fecha de fin </span>

                    <span class="detail-value">
                      {{
                        formatFechaISO(solicitudSeleccionada.fecha_fin || "")
                      }}
                    </span>
                  </div>

                  <div class="detail-item detail-item--wide">
                    <span class="detail-label"> Materia afectada </span>

                    <span class="detail-value">
                      {{ solicitudSeleccionada.materia ?? "—" }}
                    </span>
                  </div>
                </div>
              </section>

              <!-- =================================================
                   REPROGRAMACIÓN PROPUESTA
                   ================================================= -->

              <section
                v-if="solicitudSeleccionada.tipo === 'inasistencia'"
                class="detail-section"
              >
                <div class="detail-section-head">
                  <h3 class="detail-section-title">Reprogramación propuesta</h3>
                </div>

                <div class="detail-grid detail-grid--2">
                  <div class="detail-item detail-item--wide">
                    <span class="detail-label"> Tipo de reprogramación </span>

                    <span class="detail-value detail-value--highlight">
                      {{
                        labelTipoReprogramacion(
                          solicitudSeleccionada.tipo_reprogramacion || "",
                        ) || "—"
                      }}
                    </span>
                  </div>
                </div>

                <!-- =================================================
                     FECHAS PROPUESTAS SELECCIONABLES
                     ================================================= -->

                <div
                  v-if="fechasReprogramacionLista(solicitudSeleccionada).length"
                  class="repro-opciones"
                >
                  <div class="repro-opciones-title">
                    <span>
                      {{
                        solicitudSeleccionada.estado === "Pendiente"
                          ? "Selecciona una fecha"
                          : "Fechas propuestas"
                      }}
                    </span>

                    <span
                      v-if="solicitudSeleccionada.estado === 'Pendiente'"
                      class="repro-required"
                    >
                      Selección requerida
                    </span>
                  </div>

                  <!--
                    IMPORTANTE:
                    Cada opción ahora es un botón.
                    Esto permite seleccionar directamente
                    la fecha propuesta.
                  -->

                  <button
                    v-for="(fecha, idx) in fechasReprogramacionLista(
                      solicitudSeleccionada,
                    )"
                    :key="idx"
                    type="button"
                    :disabled="solicitudSeleccionada.estado !== 'Pendiente'"
                    :class="[
                      'repro-opcion',
                      {
                        'repro-opcion--elegida':
                          fechaReproSeleccionada === fecha,
                        'repro-opcion--disabled':
                          solicitudSeleccionada.estado !== 'Pendiente',
                      },
                    ]"
                    @click="seleccionarFechaReprogramacion(fecha)"
                  >
                    <span
                      class="repro-radio"
                      :class="{
                        checked: fechaReproSeleccionada === fecha,
                      }"
                    >
                      <span
                        v-if="fechaReproSeleccionada === fecha"
                        class="repro-radio-dot"
                      />
                    </span>

                    <span class="repro-opcion-content">
                      <span class="repro-opcion-num">
                        Opción {{ idx + 1 }}
                      </span>

                      <span class="repro-opcion-fecha">
                        {{ formatFechaHoraSolicitud(fecha) }}
                      </span>
                    </span>

                    <span
                      v-if="fechaReproSeleccionada === fecha"
                      class="repro-opcion-badge"
                    >
                      Seleccionada
                    </span>
                  </button>
                </div>

                <p v-else class="detail-text detail-text--muted">
                  Sin fechas propuestas
                </p>
              </section>

              <!-- =================================================
                   INFORMACIÓN ACADÉMICA
                   ================================================= -->

              <section
                v-else-if="solicitudSeleccionada.tipo !== 'flexibilizacion'"
                class="detail-section"
              >
                <div class="detail-section-head">
                  <h3 class="detail-section-title">Información académica</h3>
                </div>

                <div class="detail-grid detail-grid--2">
                  <div class="detail-item">
                    <span class="detail-label"> Tipo de solicitud </span>

                    <span class="detail-value">
                      {{
                        tipoLabel[solicitudSeleccionada.tipo] ??
                        solicitudSeleccionada.tipo
                      }}
                    </span>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label"> Materia </span>

                    <span class="detail-value">
                      {{ solicitudSeleccionada.materia ?? "—" }}
                    </span>
                  </div>
                </div>
              </section>

              <!-- =================================================
                   CONTACTO
                   ================================================= -->

              <section
                v-if="solicitudSeleccionada.tipo === 'flexibilizacion'"
                class="detail-section"
              >
                <div class="detail-section-head">
                  <h3 class="detail-section-title">Contacto</h3>
                </div>

                <div class="detail-grid detail-grid--2">
                  <div class="detail-item">
                    <span class="detail-label"> Correo institucional </span>

                    <span class="detail-value">
                      {{ solicitudSeleccionada.correo ?? "—" }}
                    </span>
                  </div>

                  <div class="detail-item">
                    <span class="detail-label"> Celular </span>

                    <span class="detail-value">
                      {{ solicitudSeleccionada.celular ?? "—" }}
                    </span>
                  </div>
                </div>
              </section>

              <!-- =================================================
                   MOTIVO
                   ================================================= -->

              <section class="detail-section">
                <div class="detail-section-head">
                  <h3 class="detail-section-title">
                    {{
                      solicitudSeleccionada.tipo === "flexibilizacion"
                        ? "Justa causa"
                        : "Motivo de la solicitud"
                    }}
                  </h3>
                </div>

                <p class="detail-text">
                  {{ solicitudSeleccionada.motivo ?? "—" }}
                </p>
              </section>

              <!-- =================================================
                   DESCRIPCIÓN
                   ================================================= -->

              <section
                v-if="
                  solicitudSeleccionada.descripcion &&
                  solicitudSeleccionada.tipo !== 'inasistencia'
                "
                class="detail-section"
              >
                <div class="detail-section-head">
                  <h3 class="detail-section-title">Descripción adicional</h3>
                </div>

                <p class="detail-text">
                  {{ solicitudSeleccionada.descripcion }}
                </p>
              </section>

              <!-- =================================================
                   PDF
                   ================================================= -->

              <section
                v-if="solicitudSeleccionada.pdf_url"
                class="detail-section"
              >
                <div class="detail-section-head">
                  <h3 class="detail-section-title">Documentación de soporte</h3>
                </div>

                <a
                  :href="solicitudSeleccionada.pdf_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="pdf-link"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    />

                    <polyline points="14 2 14 8 20 8" />
                  </svg>

                  Ver documento PDF
                </a>
              </section>
            </div>

            <!-- =================================================
                 FOOTER MODAL DETALLE
                 ================================================= -->

            <div class="modal-footer modal-footer--detail">
              <button class="btn btn-ghost" @click="cerrarModalDetalle">
                Cerrar
              </button>

              <template v-if="solicitudSeleccionada?.estado === 'Pendiente'">
                <button
                  class="btn btn-reject"
                  @click="
                    modalVerVisible = false;
                    pedirConfirmacion(solicitudSeleccionada, 'rechazar');
                  "
                >
                  Rechazar
                </button>

                <button
                  class="btn btn-approve"
                  @click="
                    modalVerVisible = false;
                    pedirConfirmacion(solicitudSeleccionada, 'aprobar');
                  "
                >
                  Aprobar
                </button>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- =====================================================
         MODAL CONFIRMAR ACCIÓN
         ===================================================== -->

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="modalConfirmVisible"
          class="modal-overlay"
          @click.self="cancelarAccion"
        >
          <div class="modal-card modal-card--sm">
            <!-- HEADER -->
            <div class="modal-header">
              <div>
                <h2 class="modal-title">
                  {{
                    accionPendiente === "aprobar"
                      ? "Aprobar solicitud"
                      : "Rechazar solicitud"
                  }}
                </h2>

                <p class="modal-subtitle">
                  Esta acción actualizará el estado de la solicitud
                </p>
              </div>
            </div>

            <!-- BODY -->
            <div class="modal-body">
              <p class="confirm-text">
                ¿Seguro que deseas

                <strong>
                  {{ accionPendiente === "aprobar" ? "aprobar" : "rechazar" }}
                </strong>

                la solicitud de

                <strong> {{ solicitudAccion?.nombre }} </strong>?
              </p>

              <!-- =================================================
                   MOTIVO RECHAZO
                   ================================================= -->

              <div v-if="accionPendiente === 'rechazar'" class="form-group">
                <label class="detail-label">
                  Motivo de rechazo
                  <span style="color: #dc2626"> * </span>
                </label>

                <textarea
                  v-model="motivoRechazo"
                  class="motivo-textarea"
                  :class="{
                    'motivo-textarea--error': errorMotivoRechazo,
                  }"
                  rows="3"
                  placeholder="Escribe el motivo del rechazo para notificar al estudiante..."
                  @input="errorMotivoRechazo = false"
                />

                <p v-if="errorMotivoRechazo" class="motivo-error">
                  Primero debes escribir el motivo del rechazo.
                </p>
              </div>

              <!-- =================================================
                   SELECCIÓN DE FECHA
                   ================================================= -->

              <div
                v-if="
                  accionPendiente === 'aprobar' &&
                  solicitudAccion?.tipo === 'inasistencia' &&
                  fechasReprogramacionLista(solicitudAccion).length
                "
                class="form-group"
              >
                <label class="detail-label">
                  Fecha de reprogramación
                  <span v-if="requiereSeleccionFecha" style="color: #dc2626">
                    *
                  </span>
                </label>

                <div
                  class="repro-opciones-select"
                  :class="{
                    'repro-opciones-select--error': errorFechaRepro,
                  }"
                >
                  <label
                    v-for="(fecha, idx) in fechasReprogramacionLista(
                      solicitudAccion,
                    )"
                    :key="idx"
                    class="repro-opcion-radio"
                    :class="{
                      selected: fechaReproSeleccionada === fecha,
                    }"
                  >
                    <input
                      type="radio"
                      name="fecha-repro"
                      :value="fecha"
                      v-model="fechaReproSeleccionada"
                      @change="errorFechaRepro = false"
                    />

                    <span class="repro-opcion-radio-label">
                      <span class="repro-opcion-num">
                        Opción {{ idx + 1 }}
                      </span>

                      <span class="repro-opcion-fecha">
                        {{ formatFechaHoraSolicitud(fecha) }}
                      </span>
                    </span>
                  </label>
                </div>

                <p v-if="errorFechaRepro" class="motivo-error">
                  Debes seleccionar una de las fechas propuestas.
                </p>
              </div>

              <div
                v-if="
                  accionPendiente === 'aprobar' &&
                  solicitudAccion?.tipo === 'inasistencia'
                "
                class="form-group"
              >
                <label class="detail-label" for="mensaje-aprobacion">
                  Mensaje para el docente
                  <span class="optional-label"> (opcional) </span>
                </label>

                <textarea
                  id="mensaje-aprobacion"
                  v-model="mensajeAprobacion"
                  class="motivo-textarea"
                  rows="3"
                  placeholder="Escribe un mensaje adicional para el docente..."
                />
              </div>
            </div>

            <!-- FOOTER -->
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="cancelarAccion">
                Cancelar
              </button>

              <button
                :class="[
                  'btn',
                  accionPendiente === 'aprobar' ? 'btn-approve' : 'btn-reject',
                ]"
                :disabled="confirmandoAccion"
                @click="intentarConfirmar"
              >
                <span v-if="confirmandoAccion" class="btn-spinner" />

                {{
                  confirmandoAccion
                    ? accionPendiente === "aprobar"
                      ? "Aprobando..."
                      : "Rechazando..."
                    : accionPendiente === "aprobar"
                      ? "Sí, aprobar"
                      : "Sí, rechazar"
                }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- =====================================================
         TOAST
         ===================================================== -->

    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toastVisible" class="toast-success">
          <div class="toast-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <span>
            {{ toastMensaje }}
          </span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* =========================================================
   GENERAL
   ========================================================= */

.solicitudes-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pending-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  background: #fef3c7;
  color: #d97706;
  font-size: 13px;
  font-weight: 600;
}

.pending-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d97706;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

/* =========================================================
   TOOLBAR
   ========================================================= */

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.filter-tabs {
  display: flex;
  gap: 6px;
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  transition: all var(--transition);
  cursor: pointer;
}

.filter-tab:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

.filter-tab.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 320px;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 9px 36px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition);
}

.search-input:focus {
  border-color: var(--color-primary);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-clear {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 4px;
}

.search-clear:hover {
  color: var(--color-text);
}

/* =========================================================
   LOADING
   ========================================================= */

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* =========================================================
   CARD
   ========================================================= */

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.requests-list {
  display: flex;
  flex-direction: column;
}

.request-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border-light);
  gap: 20px;
  transition: background var(--transition);
}

.request-item:last-child {
  border-bottom: none;
}

.request-item:hover {
  background: var(--color-background);
}

.request-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.request-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.request-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.request-top {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.request-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.request-details {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-wrap: wrap;
}

.tipo-tag {
  font-weight: 500;
  color: var(--color-text-secondary);
}

.separator {
  color: var(--color-text-muted);
}

.request-motivo {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 2px 0 0;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

/* =========================================================
   ACTIONS
   ========================================================= */

.request-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all var(--transition);
}

.action-btn.view {
  background: var(--color-background);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.action-btn.view:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

.action-btn.approve {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.action-btn.approve:hover {
  background: var(--color-success);
  color: white;
}

.action-btn.reject {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.reject:hover {
  background: #dc2626;
  color: white;
}

.action-btn.delete {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.delete:hover {
  background: #dc2626;
  color: white;
}

/* =========================================================
   STATUS
   ========================================================= */

.status-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.badge-pendiente {
  background: #fef3c7;
  color: #d97706;
}

.badge-aprobada {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.badge-rechazada {
  background: #fee2e2;
  color: #dc2626;
}

/* =========================================================
   PAGINATION
   ========================================================= */

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-info {
  font-size: 13px;
  color: var(--color-text-muted);
}

/* =========================================================
   FORM
   ========================================================= */

.form-group {
  display: flex;
  flex-direction: column;
}

.motivo-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-surface);
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
  margin-top: 6px;
}

.motivo-textarea:focus {
  border-color: #dc2626;
  outline: none;
}

.motivo-textarea--error {
  border-color: #dc2626;
  background: #fef2f2;
}

.motivo-error {
  margin: 6px 0 0;
  font-size: 12px;
  color: #dc2626;
  font-weight: 500;
}

.optional-label {
  color: var(--color-text-muted);
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
}

/* =========================================================
   REPROGRAMACIÓN
   ========================================================= */

.repro-opciones {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.repro-opciones-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.repro-required {
  color: #dc2626;
  font-size: 10px;
}

.repro-opcion {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--color-background);
  border: 1px solid var(--color-border-light);
  cursor: pointer;
  text-align: left;
  transition:
    border-color var(--transition),
    background var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
  color: inherit;
}

.repro-opcion:hover:not(:disabled) {
  border-color: var(--color-accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.repro-opcion--elegida {
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.repro-opcion--disabled {
  cursor: default;
}

.repro-opcion-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.repro-opcion-num {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-text-muted);
  min-width: 72px;
}

.repro-opcion-fecha {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.repro-opcion-badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-success);
  background: white;
  padding: 3px 9px;
  border-radius: 999px;
}

.repro-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-surface);
  transition: all var(--transition);
}

.repro-radio.checked {
  border-color: var(--color-success);
}

.repro-radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
}

/* =========================================================
   SELECTOR DEL MODAL DE APROBACIÓN
   ========================================================= */

.repro-opciones-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
  border-radius: var(--radius);
}

.repro-opciones-select--error {
  outline: 1px solid #dc2626;
  border-radius: var(--radius);
  padding: 4px;
}

.repro-opcion-radio {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius);
  background: var(--color-background);
  border: 1px solid var(--color-border-light);
  cursor: pointer;
  transition:
    border-color var(--transition),
    background var(--transition);
}

.repro-opcion-radio:hover {
  border-color: var(--color-text-muted);
}

.repro-opcion-radio.selected {
  border-color: var(--color-accent);
  background: color-mix(
    in srgb,
    var(--color-accent) 8%,
    var(--color-background)
  );
}

.repro-opcion-radio input {
  flex-shrink: 0;
}

.repro-opcion-radio-label {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* =========================================================
   MODALES
   ========================================================= */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  width: 100%;
  max-width: 520px;
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-card--sm {
  max-width: 400px;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 24px 20px;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 4px;
}

.modal-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: var(--color-background);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  flex-shrink: 0;
}

.modal-close:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

.modal-divider {
  height: 1px;
  background: var(--color-border-light);
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.modal-footer {
  padding: 16px 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.modal-card--detail {
  max-width: 920px;
}

.modal-header--detail {
  padding: 28px 28px 24px;
  align-items: center;
}

.modal-body--detail {
  padding: 4px 32px 28px;
  gap: 0;
  background: var(--color-surface);
}

.modal-footer--detail {
  padding: 16px 28px 24px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-surface);
}

/* =========================================================
   DETAIL
   ========================================================= */

.detail-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  flex: 1;
  min-width: 0;
}

.detail-hero-avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  flex-shrink: 0;
  background: linear-gradient(
    135deg,
    var(--color-accent),
    color-mix(in srgb, var(--color-accent) 70%, #6366f1)
  );
  color: white;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px
    color-mix(in srgb, var(--color-accent) 35%, transparent);
}

.detail-hero-info {
  min-width: 0;
}

.detail-hero-info .modal-title {
  font-size: 20px;
  margin-bottom: 6px;
}

.detail-hero-info .modal-subtitle {
  font-size: 13px;
}

.detail-hero-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.detail-meta-chip {
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-background);
  border: 1px solid var(--color-border-light);
  padding: 4px 10px;
  border-radius: 999px;
}

.detail-section {
  background: none;
  border: none;
  border-radius: 0;
  padding: 20px 0;
}

.detail-section + .detail-section {
  border-top: 1px solid var(--color-border-light);
}

.detail-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 0;
  border-bottom: none;
}

.detail-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 24px;
}

.detail-grid--2 {
  grid-template-columns: repeat(2, 1fr);
}

.detail-grid--3 {
  grid-template-columns: repeat(3, 1fr);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-item--wide {
  grid-column: span 2;
}

.detail-item.full {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
  line-height: 1.4;
}

.detail-value--highlight {
  color: var(--color-accent);
  font-weight: 600;
}

.detail-text {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.65;
  margin: 0;
  padding: 0;
  background: none;
  border: none;
}

.detail-text--muted {
  color: var(--color-text-muted);
  font-style: italic;
}

/* =========================================================
   PDF
   ========================================================= */

.pdf-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-accent);
  background: var(--color-info-bg);
  padding: 10px 14px;
  border-radius: var(--radius);
  text-decoration: none;
  width: fit-content;
  transition: opacity var(--transition);
}

.pdf-link:hover {
  opacity: 0.75;
}

/* =========================================================
   BOTONES
   ========================================================= */

.confirm-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.6;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all var(--transition);
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-ghost {
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-ghost:hover {
  background: var(--color-border-light);
}

.btn-approve {
  background: var(--color-success);
  color: white;
}

.btn-approve:hover {
  opacity: 0.9;
}

.btn-reject {
  background: #dc2626;
  color: white;
}

.btn-reject:hover {
  background: #b91c1c;
}

.btn-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* =========================================================
   TOAST
   ========================================================= */

.toast-success {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #111827;
  color: white;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

.toast-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* =========================================================
   TRANSITIONS
   ========================================================= */

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}

/* =========================================================
   RESPONSIVE
   ========================================================= */

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .filter-tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
  }

  .search-wrapper {
    max-width: none;
    width: 100%;
  }

  .request-item {
    flex-direction: column;
    padding: 16px;
    gap: 12px;
  }

  .request-motivo {
    white-space: normal;
    max-width: none;
  }

  .request-actions {
    width: 100%;
    flex-wrap: wrap;
    gap: 8px;
  }

  .action-btn {
    flex: 1 1 calc(50% - 4px);
    justify-content: center;
    min-height: 40px;
  }

  .modal-overlay {
    padding: 12px;
    align-items: flex-end;
  }

  .modal-card--detail {
    max-width: 100%;
    max-height: 92vh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .modal-header--detail {
    padding: 20px 16px 16px;
  }

  .modal-body--detail {
    padding: 4px 16px 20px;
  }

  .modal-footer--detail {
    padding: 12px 16px 20px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .modal-footer--detail .btn {
    flex: 1 1 auto;
    justify-content: center;
    min-width: calc(50% - 4px);
  }

  .detail-grid--3,
  .detail-grid--2 {
    grid-template-columns: 1fr;
  }

  .detail-item--wide {
    grid-column: span 1;
  }

  .detail-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .repro-opcion-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .repro-opcion-num {
    min-width: auto;
  }

  .toast-success {
    left: 16px;
    right: 16px;
    bottom: 16px;
  }
}

@media (max-width: 480px) {
  .filter-tab {
    padding: 7px 11px;
    font-size: 12px;
    flex-shrink: 0;
  }

  .request-item {
    padding: 14px 12px;
  }

  .request-actions {
    flex-direction: column;
  }

  .action-btn {
    flex: 1 1 100%;
    width: 100%;
  }

  .modal-footer--detail .btn {
    width: 100%;
    min-width: 0;
  }

  .repro-opcion {
    align-items: flex-start;
  }

  .repro-opcion-badge {
    margin-left: auto;
  }

  .repro-opcion-radio-label {
    flex-wrap: wrap;
  }
}
</style>
