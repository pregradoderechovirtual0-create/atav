import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type SolicitudDocente, mapDocSolicitud } from "@/lib/solicitudes/docenteSolicitudes";
import { cargarSuscripcionesMateria } from "@/lib/dominio/suscripcionesMaterias";

export type AusentismoDocente = Pick<
  SolicitudDocente,
  | "tipoLabel"
  | "fecha_inicio"
  | "fecha_fin"
  | "materia"
  | "descripcion"
  | "tipoReprogramacionLabel"
  | "fechas_reprogramacion"
  | "estadoLabel"
  | "fecha"
  | "fechaSort"
>;

export const fetchAusentismosDocente = async (
  estudianteUid: string,
): Promise<AusentismoDocente[]> => {
  const suscripciones = await cargarSuscripcionesMateria(estudianteUid);
  const codigos = [...new Set(
    suscripciones
      .map((suscripcion) => suscripcion.materia_codigo.trim())
      .filter(Boolean),
  )];

  const solicitudes = await Promise.all(
    codigos.map(async (materiaCodigo) => {
      const snap = await getDocs(
        query(
          collection(db, "solicitudes"),
          where("materia_codigo", "==", materiaCodigo),
        ),
      );
      return snap.docs.map((item) => mapDocSolicitud(item.id, item.data()));
    }),
  );

  return solicitudes
    .flat()
    .sort((a, b) => b.fechaSort - a.fechaSort)
    .map(({ tipoLabel, fecha_inicio, fecha_fin, materia, descripcion,
      tipoReprogramacionLabel, fechas_reprogramacion, estadoLabel, fecha, fechaSort,
    }) => ({
      tipoLabel,
      fecha_inicio,
      fecha_fin,
      materia,
      descripcion,
      tipoReprogramacionLabel,
      fechas_reprogramacion,
      estadoLabel,
      fecha,
      fechaSort,
    }));
};
