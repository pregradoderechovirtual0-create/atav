import { doc, getDoc, updateDoc, setDoc, deleteDoc, deleteField } from 'firebase/firestore'
import {
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  signInAnonymously,
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { hashPassword } from '@/lib/autenticacion/passwordUtils'

export class CambioPasswordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CambioPasswordError'
  }
}

export async function consultarRequiereCambioPassword(cedula: string): Promise<boolean> {
  if (!/^\d+$/.test(cedula)) return false
  try {
    const snap = await getDoc(doc(db, 'usuarios', cedula))
    return snap.exists() && snap.data().requiereCambioPassword === true
  } catch {
    return false
  }
}

/**
 * Tras un reset del director, el usuario elige su contraseña definitiva.
 * Si puede, usa updatePassword de Firebase (plan Spark, sin Cloud Functions).
 */
export async function establecerPasswordPropio(
  cedula: string,
  contraseñaAsignada: string,
  nuevaPassword: string,
): Promise<{ authSincronizado: boolean }> {
  if (nuevaPassword.length < 6) {
    throw new CambioPasswordError('La contraseña debe tener mínimo 6 caracteres')
  }
  if (nuevaPassword === contraseñaAsignada) {
    throw new CambioPasswordError(
      'Elige una contraseña distinta a la que te asignó administración',
    )
  }

  const email = `${cedula}@atav.com`
  const userRef = doc(db, 'usuarios', cedula)
  const snap = await getDoc(userRef)

  if (!snap.exists()) {
    throw new CambioPasswordError('Usuario no encontrado')
  }

  const data = snap.data()
  if (data.requiereCambioPassword !== true) {
    throw new CambioPasswordError('No hay cambio de contraseña pendiente')
  }

  const rol = (data.rol || '').toString()
  const password_hash = await hashPassword(nuevaPassword)

  await signOut(auth)

  let authSincronizado = false
  let uid: string | undefined

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, nuevaPassword)
    uid = cred.user.uid
    authSincronizado = true
  } catch (error: unknown) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: string }).code)
        : ''

    if (code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, contraseñaAsignada)
        await updatePassword(cred.user, nuevaPassword)
        uid = cred.user.uid
        authSincronizado = true
      } catch {
        authSincronizado = false
      }
    } else if (code === 'auth/weak-password' || code === 'auth/invalid-email') {
      throw new CambioPasswordError('Contraseña no válida para Firebase Authentication')
    } else if (code) {
      throw error
    }
  }

  if (!authSincronizado) {
    try {
      await signInAnonymously(auth)
    } catch {
      throw new CambioPasswordError(
        'Activa el proveedor Anónimo en Firebase Authentication para completar el cambio.',
      )
    }

    const user = auth.currentUser
    if (!user) {
      throw new CambioPasswordError('No se pudo completar el cambio de contraseña')
    }

    await setDoc(doc(db, 'auth_vinculos', user.uid), { cedula, rol })
  }

  await updateDoc(userRef, {
    password_hash,
    requiereCambioPassword: false,
    passwordTemporal: false,
    claveTemporal: deleteField(),
    authDesincronizado: !authSincronizado,
    ...(authSincronizado && uid ? { auth_uid: uid } : {}),
  })

  if (auth.currentUser?.uid) {
    localStorage.setItem('uid', auth.currentUser.uid)
    if (authSincronizado) {
      await deleteDoc(doc(db, 'auth_vinculos', auth.currentUser.uid)).catch(() => {})
    }
  }

  return { authSincronizado }
}
