import { doc, getDoc, updateDoc, setDoc, deleteDoc, deleteField } from 'firebase/firestore'
import {
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db, app } from '@/lib/firebase'
import { getSecondaryAuth } from '@/lib/secondaryAuth'
import { hashPassword } from '@/lib/passwordUtils'

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

export async function restablecerPasswordUsuario(
  cedula: string,
  nuevaPassword: string,
): Promise<ResultadoResetPassword> {
  const ref = doc(db, 'usuarios', cedula)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Usuario no encontrado')

  const email = `${cedula}@atav.com`
  const password_hash = await hashPassword(nuevaPassword)
  const secondaryAuth = getSecondaryAuth()
  let authSincronizado = false
  let uid: string | undefined = snap.data().auth_uid as string | undefined

  const cloudOk = await intentarResetConCloudFunction(cedula, nuevaPassword)
  if (cloudOk) {
    authSincronizado = true
  } else {
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, nuevaPassword)
      uid = cred.user.uid
      authSincronizado = true
    } catch (error: unknown) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : ''

      if (code === 'auth/email-already-in-use') {
        try {
          const cred = await signInWithEmailAndPassword(secondaryAuth, email, nuevaPassword)
          uid = cred.user.uid
          authSincronizado = true
        } catch {
          // Auth sigue con la clave vieja: el usuario entrará con hash + sesión anónima
          authSincronizado = false
        }
      } else {
        throw error
      }
    } finally {
      await signOut(secondaryAuth).catch(() => {})
    }
  }

  await updateDoc(ref, {
    registrado: true,
    ...(authSincronizado && uid ? { auth_uid: uid } : {}),
    password_hash,
    authDesincronizado: !authSincronizado,
    passwordTemporal: !authSincronizado,
    claveTemporal: deleteField(),
    requiereCambioPassword: false,
  })

  return { authSincronizado }
}
