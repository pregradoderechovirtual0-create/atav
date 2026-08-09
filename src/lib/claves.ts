import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { hashPassword, verifyPassword } from '@/lib/passwordUtils'

const CONFIG_SEGURIDAD = doc(db, 'config', 'seguridad')

export async function existeClaveAutorizacionJefa(): Promise<boolean> {
  try {
    const snap = await getDoc(CONFIG_SEGURIDAD)
    return typeof snap.data()?.clave_jefa_hash === 'string' && snap.data()!.clave_jefa_hash.length > 0
  } catch {
    return false
  }
}

export async function verificarClaveAutorizacionJefa(clave: string): Promise<boolean> {
  const snap = await getDoc(CONFIG_SEGURIDAD)
  const stored = snap.data()?.clave_jefa_hash
  if (typeof stored !== 'string' || !stored) return false
  return verifyPassword(clave, stored)
}

export async function establecerClaveAutorizacionJefa(clave: string): Promise<void> {
  const hash = await hashPassword(clave)
  const snap = await getDoc(CONFIG_SEGURIDAD)

  if (!snap.exists()) {
    await setDoc(CONFIG_SEGURIDAD, { clave_jefa_hash: hash })
    return
  }

  const actual = snap.data()?.clave_jefa_hash
  if (typeof actual !== 'string' || !actual) {
    await setDoc(CONFIG_SEGURIDAD, { clave_jefa_hash: hash }, { merge: true })
    return
  }

  await updateDoc(CONFIG_SEGURIDAD, { clave_jefa_hash: hash })
}
