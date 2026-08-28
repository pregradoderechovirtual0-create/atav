import {
  collection,
  getDocs,
  onSnapshot,
  type QuerySnapshot,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { obtenerSesion } from "@/lib/autenticacion/session";
import { labelEstadoUI } from "@/lib/solicitudes/dashboardSolicitudes";
import { labelCausaFlexibilidad } from "@/lib/dominio/flexibilidadCatalogo";
import {
  labelMateriaPorCodigo,
  type MateriaRegistrada,
} from "@/lib/dominio/materias";

export interface SolicitudDirector {
  id: string;
  nombre: string;
  estado: string;
  tipo: string;
  materia: string;
  motivo: string;
  descripcion: string;
  cedula: string;
  creadoEn: unknown;
  coleccion: string;
  motivo_rechazo: string;
  pdf_url: string;
  usuario_id?: string;
  docente_id?: string;
  estudiante_id?: string;
  correo?: string;
  celular?: string;
  parcial?: string;
  cursoId?: string;
  fechaParcial?: unknown;
  horaParcial?: unknown;
  fecha_inicio?: string;
  fecha_fin?: string;
  tipo_reprogramacion?: string;
  fechas_reprogramacion?: string[];
  tipo_ausentismo?: string;
  fecha_reprogramacion_seleccionada?: string;
}

const tsSeconds = (ts: unknown): number => {
  if (!ts) return 0;
  if (typeof ts === "object" && ts !== null) {
    const sec = (ts as { seconds?: number }).seconds;
    if (typeof sec === "number") return sec;
    const toDate = (ts as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") {
      const ms = toDate.call(ts).getTime();
      return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
    }
  }
  if (typeof ts === "string" || typeof ts === "number") {
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
  }
  return 0;
};

export function mapSnapSolicitudesDirector(
  snapSolicitudes: {
    docs: Array<{ id: string; data: () => Record<string, unknown> }>;
  },
  snapFlex: {
    docs: Array<{ id: string; data: () => Record<string, unknown> }>;
  },
  snapSup: { docs: Array<{ id: string; data: () => Record<string, unknown> }> },
  snapHab: { docs: Array<{ id: string; data: () => Record<string, unknown> }> },
  materias: MateriaRegistrada[],
): SolicitudDirector[] {
  const solicitudesData = snapSolicitudes.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      nombre: String(data.docente_nombre || data.nombre || "—"),
      estado: labelEstadoUI(String(data.estado || "creada")),
      tipo: "inasistencia",
      materia: String(data.materia_label || data.materia || "—"),
      motivo: String(data.descripcion || data.tipo_ausentismo || "—"),
      descripcion: String(data.descripcion || ""),
      usuario_id: data.usuario_id as string | undefined,
      docente_id: data.usuario_id as string | undefined,
      cedula: String(data.cedula || data.identificacion || "—"),
      creadoEn: data.fecha_creacion || data.creadoEn,
      coleccion: "solicitudes",
      motivo_rechazo: String(data.motivo_rechazo || ""),
      fecha_inicio: data.fecha_inicio as string | undefined,
      fecha_fin: data.fecha_fin as string | undefined,
      tipo_ausentismo: data.tipo_ausentismo as string | undefined,
      tipo_reprogramacion: data.tipo_reprogramacion as string | undefined,
      fechas_reprogramacion: (data.fechas_reprogramacion as string[]) || [],
      pdf_url: String(data.pdf_url || ""),
    };
  });

  const flexData = snapFlex.docs.map((d) => {
    const data = d.data();
    const cursoLabel = String(
      data.curso_label ||
        labelMateriaPorCodigo(
          String(data.curso || ""),
          materias,
          String(data.curso || ""),
        ),
    );
    const causaLabel = String(
      data.justa_causa_label ||
        labelCausaFlexibilidad(
          String(data.justa_causa || ""),
          String(data.justa_causa || ""),
        ),
    );
    return {
      id: d.id,
      nombre: String(data.nombre || "—"),
      estado: labelEstadoUI(String(data.estado || "pendiente")),
      tipo: "flexibilizacion",
      parcial: data.parcial as string | undefined,
      materia: cursoLabel,
      cursoId: data.curso as string | undefined,
      motivo: causaLabel,
      descripcion: String(data.descripcion || ""),
      cedula: String(data.identificacion || "—"),
      correo: data.correo as string | undefined,
      celular: data.celular as string | undefined,
      fechaParcial: data.fecha_parcial,
      horaParcial: data.hora_parcial,
      estudiante_id: data.estudiante_id as string | undefined,
      creadoEn: data.fecha_creacion,
      coleccion: "flexibilizaciones",
      pdf_url: String(data.pdf_url || ""),
      motivo_rechazo: String(data.motivo_rechazo || ""),
    };
  });

  const suplData = snapSup.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      nombre: String(data.nombre || "—"),
      estado: labelEstadoUI(String(data.estado || "pendiente")),
      tipo: "supletorio",
      materia: String(data.nombre_curso || data.curso || "—"),
      motivo: String(data.actividades || "—"),
      descripcion: `Unidades: ${data.unidades || "—"} · Actividades: ${data.actividades || "—"}`,
      cedula: String(data.identificacion || "—"),
      estudiante_id: data.estudiante_id as string | undefined,
      creadoEn: data.fecha_creacion,
      coleccion: "supletorios",
      pdf_url: String(data.pdf_url || ""),
      motivo_rechazo: String(data.motivo_rechazo || ""),
    };
  });

  const habilData = snapHab.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      nombre: String(data.nombre || "—"),
      estado: labelEstadoUI(String(data.estado || "pendiente")),
      tipo: "habilitacion",
      materia: String(data.nombre_curso || "—"),
      motivo: String(data.actividades || "—"),
      descripcion: `Unidades: ${data.unidades || "—"} · Actividades: ${data.actividades || "—"}`,
      cedula: String(data.identificacion || "—"),
      estudiante_id: data.estudiante_id as string | undefined,
      creadoEn: data.fecha_creacion,
      coleccion: "habilitaciones",
      pdf_url: String(data.pdf_url || ""),
      motivo_rechazo: String(data.motivo_rechazo || ""),
    };
  });

  return [...solicitudesData, ...flexData, ...suplData, ...habilData].sort(
    (a, b) => tsSeconds(b.creadoEn) - tsSeconds(a.creadoEn),
  );
}

export async function fetchSolicitudesDirector(
  materias: MateriaRegistrada[],
): Promise<SolicitudDirector[]> {
  await obtenerSesion();

  const emptySnap = { docs: [] } as QuerySnapshot<DocumentData>;

  const readCollection = async (
    name: string,
  ): Promise<QuerySnapshot<DocumentData>> => {
    try {
      return await getDocs(collection(db, name));
    } catch (err) {
      console.error(`[ATAV] Error leyendo colección ${name}:`, err);
      return emptySnap;
    }
  };

  const [snapSolicitudes, snapFlex, snapSup, snapHab] = await Promise.all([
    readCollection("solicitudes"),
    readCollection("flexibilizaciones"),
    readCollection("supletorios"),
    readCollection("habilitaciones"),
  ]);

  return mapSnapSolicitudesDirector(
    snapSolicitudes,
    snapFlex,
    snapSup,
    snapHab,
    materias,
  );
}

type SnapLike = {
  docs: Array<{ id: string; data: () => Record<string, unknown> }>;
};

/** Escucha cambios en tiempo real en las 4 colecciones de solicitudes. */
export function subscribeSolicitudesDirector(
  materias: MateriaRegistrada[],
  onUpdate: (solicitudes: SolicitudDirector[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const state: Record<"solicitudes" | "flex" | "sup" | "hab", SnapLike> = {
    solicitudes: { docs: [] },
    flex: { docs: [] },
    sup: { docs: [] },
    hab: { docs: [] },
  };

  const emit = () => {
    onUpdate(
      mapSnapSolicitudesDirector(
        state.solicitudes,
        state.flex,
        state.sup,
        state.hab,
        materias,
      ),
    );
  };

  const collections: Array<[string, keyof typeof state]> = [
    ["solicitudes", "solicitudes"],
    ["flexibilizaciones", "flex"],
    ["supletorios", "sup"],
    ["habilitaciones", "hab"],
  ];

  const unsubs = collections.map(([name, key]) =>
    onSnapshot(
      collection(db, name),
      (snap) => {
        state[key] = snap;
        emit();
      },
      (err) => onError?.(err),
    ),
  );

  return () => unsubs.forEach((u) => u());
}

export function nombreSolicitudDirector(s: SolicitudDirector): string {
  return s.nombre || "—";
}
