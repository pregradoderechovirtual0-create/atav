import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MateriaRegistrada } from "@/lib/dominio/materias";

export interface SuscripcionMateria {
  id: string;
  estudiante_id: string;
  materia_codigo: string;
  materia_label: string;
  profesor: string;
  semestre: string;
}

const suscripcionId = (uid: string, codigo: string) =>
  `${uid}_${codigo.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

export async function cargarSuscripcionesMateria(
  uid: string,
): Promise<SuscripcionMateria[]> {
  const snap = await getDocs(
    query(
      collection(db, "suscripciones_materias"),
      where("estudiante_id", "==", uid),
    ),
  );
  const suscripciones = snap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as SuscripcionMateria,
  );
  return suscripciones;
}

export async function suscribirMateria(
  uid: string,
  materia: MateriaRegistrada,
) {
  const id = suscripcionId(uid, materia.codigo);
  await setDoc(doc(db, "suscripciones_materias", id), {
    estudiante_id: uid,
    materia_codigo: materia.codigo,
    materia_label: `${materia.codigo} — ${materia.nombre}`,
    profesor: materia.profesor || "",
    semestre: materia.semestre || "",
    creado_en: new Date(),
  });
}

export async function cancelarSuscripcion(uid: string, codigo: string) {
  await deleteDoc(
    doc(db, "suscripciones_materias", suscripcionId(uid, codigo)),
  );
}
