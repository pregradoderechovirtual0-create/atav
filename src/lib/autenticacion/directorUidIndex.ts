import { doc, deleteDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { esRolDirector } from '@/lib/nucleo/roles'

/** Índice usado por Security Rules para validar notificaciones a directores. */
export async function sincronizarIndiceDirectorUid(
  authUid: string,
  rol: string,
  cedula: string,
): Promise<void> {
  if (!authUid?.trim() || !esRolDirector(rol)) return
  await setDoc(doc(db, 'indices/director_uids', authUid.trim()), {
    cedula: cedula.trim(),
    rol,
  })
}

export async function quitarIndiceDirectorUid(authUid: string): Promise<void> {
  if (!authUid?.trim()) return
  await deleteDoc(doc(db, 'indices/director_uids', authUid.trim())).catch(() => {})
}
