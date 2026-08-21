import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore'
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db, app } from '@/lib/firebase'
import { getSecondaryAuth } from '@/lib/autenticacion/secondaryAuth'
import { hashPassword } from '@/lib/autenticacion/passwordUtils'

export interface ResultadoResetPassword {
  authSincronizado: boolean
}

async function intentarResetConCloudFunction(
  cedula: string,
  nuevaPassword: string,
): Promise<boolean> {
  try {
    const fn = httpsCallable(getFunctions(app), 'cambiarPasswordUsuario')
    await fn({ cedula, nuevaPassword })
    return true
  } catch {
    return false
  }
}

async function verificarLoginAuth(email: string, password: string): Promise<string | null> {
  const secondaryAuth = getSecondaryAuth()
  try {
    const cred = await signInWithEmailAndPassword(secondaryAuth, email, password)
    return cred.user.uid
  } catch {
    return null
  } finally {
    await signOut(secondaryAuth).catch(() => {})
  }
}

async function crearCuentaAuth(email: string, password: string): Promise<string | null> {
  const secondaryAuth = getSecondaryAuth()
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    return cred.user.uid
  } catch (error: unknown) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: string }).code)
        : ''
    if (code === 'auth/email-already-in-use') {
      return verificarLoginAuth(email, password)
    }
    throw error
  } finally {
    await signOut(secondaryAuth).catch(() => {})
  }
}

export async function restablecerPasswordUsuario(
  cedula: string,
  nuevaPassword: string,
): Promise<ResultadoResetPassword> {
  const ref = doc(db, 'usuarios', cedula)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Usuario no encontrado')

  const email = `${cedula}@atav.com`
  const password_hash = await hashPassword(nuevaPassword)
  let authSincronizado = false
  let uid: string | undefined = snap.data().auth_uid as string | undefined

  const cloudOk = await intentarResetConCloudFunction(cedula, nuevaPassword)
  if (cloudOk) {
    uid = (await verificarLoginAuth(email, nuevaPassword)) || uid
    authSincronizado = Boolean(uid)
  }

  if (!authSincronizado) {
    uid = (await crearCuentaAuth(email, nuevaPassword)) || undefined
    authSincronizado = Boolean(uid)
  }

  await updateDoc(ref, {
    registrado: true,
    ...(authSincronizado && uid ? { auth_uid: uid } : {}),
    password_hash,
    authDesincronizado: !authSincronizado,
    passwordTemporal: true,
    claveTemporal: deleteField(),
    requiereCambioPassword: false,
  })

  return { authSincronizado }
}
