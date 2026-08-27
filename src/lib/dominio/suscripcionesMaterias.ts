import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  updateDoc,
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
  correo_personal: string;
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
  return snap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as SuscripcionMateria,
  );
}

export async function guardarCorreoPersonal(cedula: string, correo: string) {
  await updateDoc(doc(db, "usuarios", cedula), {
    correo_personal: correo.trim().toLowerCase(),
  });
}

export async function suscribirMateria(
  uid: string,
  materia: MateriaRegistrada,
  correoPersonal: string,
) {
  const id = suscripcionId(uid, materia.codigo);
  await setDoc(doc(db, "suscripciones_materias", id), {
    estudiante_id: uid,
    materia_codigo: materia.codigo,
    materia_label: `${materia.codigo} — ${materia.nombre}`,
    profesor: materia.profesor || "",
    semestre: materia.semestre || "",
    correo_personal: correoPersonal.trim().toLowerCase(),
    creado_en: new Date(),
  });
}

export async function cancelarSuscripcion(uid: string, codigo: string) {
  await deleteDoc(
    doc(db, "suscripciones_materias", suscripcionId(uid, codigo)),
  );
}
