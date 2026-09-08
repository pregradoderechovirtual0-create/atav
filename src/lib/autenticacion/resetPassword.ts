import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore'
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { db } from '@/lib/firebase'
import { getSecondaryAuth } from '@/lib/autenticacion/secondaryAuth'
import { hashPassword } from '@/lib/autenticacion/passwordUtils'

export interface ResultadoResetPassword {
  /** true si también se creó/vinculó cuenta email en Firebase Auth */
  authSincronizado: boolean
}

export class ResetPasswordError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'SYNC_FAILED' = 'SYNC_FAILED',
  ) {
    super(message)
    this.name = 'ResetPasswordError'
  }
}

/**
 * Restablece contraseña sin Cloud Functions (plan Spark / gratis).
 * La fuente de verdad es password_hash en Firestore; el login valida ese hash primero.
 * Si el usuario aún no tiene cuenta {cedula}@atav.com en Firebase, se crea aquí.
 * Si ya existe, no se puede cambiar la clave en Firebase sin Admin SDK — el login
 * igual funciona vía hash + sesión anónima vinculada.
 */
async function intentarCrearCuentaEmail(email: string, password: string): Promise<string | null> {
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
      const uid = await verificarLoginAuth(email, password)
      return uid
    }

    if (code === 'auth/weak-password' || code === 'auth/invalid-email') {
      throw error
    }

    return null
  } finally {
    await signOut(secondaryAuth).catch(() => {})
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

export async function restablecerPasswordUsuario(
  cedula: string,
  nuevaPassword: string,
): Promise<ResultadoResetPassword> {
  const ref = doc(db, 'usuarios', cedula)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new ResetPasswordError('Usuario no encontrado', 'NOT_FOUND')
  }

  const email = `${cedula}@atav.com`
  const password_hash = await hashPassword(nuevaPassword)

  let authSincronizado = false
  let uid: string | undefined

  try {
    const nuevoUid = await intentarCrearCuentaEmail(email, nuevaPassword)
    if (nuevoUid) {
      uid = nuevoUid
      authSincronizado = true
    }
  } catch (error) {
    console.warn('No se pudo crear cuenta Firebase en reset (Firestore sigue siendo válido):', error)
  }

  await updateDoc(ref, {
    registrado: true,
    ...(authSincronizado && uid ? { auth_uid: uid, authDesincronizado: false } : { authDesincronizado: true }),
    password_hash,
    passwordTemporal: true,
    claveTemporal: deleteField(),
    requiereCambioPassword: true,
  })

  return { authSincronizado }
}
