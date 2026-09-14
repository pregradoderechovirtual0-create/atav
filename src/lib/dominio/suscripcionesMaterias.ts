import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  enlace_reunion?: string;
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


  const suscripciones = await Promise.all(

    snap.docs.map(async (item) => {

      const data = item.data();


      let enlace_reunion = "";


      // Buscar la materia original
      const materiaRef = doc(
        db,
        "materias",
        data.materia_codigo,
      );


      const materiaSnap = await getDoc(materiaRef);


      if (materiaSnap.exists()) {
        enlace_reunion =
          materiaSnap.data().enlace_reunion || "";
      }


      return {
        id: item.id,
        estudiante_id: data.estudiante_id,
        materia_codigo: data.materia_codigo,
        materia_label: data.materia_label,
        profesor: data.profesor,
        semestre: data.semestre,
        enlace_reunion,
      };

    }),
  );


  return suscripciones;

}



export async function suscribirMateria(
  uid: string,
  materia: MateriaRegistrada,
) {

  const id = suscripcionId(uid, materia.codigo);


  await setDoc(
    doc(db, "suscripciones_materias", id),
    {
      estudiante_id: uid,
      materia_codigo: materia.codigo,
      materia_label: `${materia.codigo} — ${materia.nombre}`,
      profesor: materia.profesor || "",
      semestre: materia.semestre || "",
      creado_en: new Date(),
    },
  );

}



export async function cancelarSuscripcion(
  uid: string,
  codigo: string,
) {

  await deleteDoc(
    doc(
      db,
      "suscripciones_materias",
      suscripcionId(uid, codigo),
    ),
  );

}