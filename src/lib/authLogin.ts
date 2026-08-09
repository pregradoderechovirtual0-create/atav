import { doc, getDoc, updateDoc, setDoc, deleteDoc, deleteField } from 'firebase/firestore'
import {
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { hashPassword, verifyPassword } from '@/lib/passwordUtils'

export class LoginError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_CREDENTIALS' | 'NOT_FOUND' | 'UNKNOWN' = 'UNKNOWN',
  ) {
    super(message)
  }
}

const emailDeCedula = (cedula: string) => `${cedula}@atav.com`

export async function configurarPersistenciaSesion(recordar: boolean) {
  await setPersistence(auth, recordar ? browserLocalPersistence : browserSessionPersistence)
}

async function entrarConSesionAnonima(cedula: string, data: Record<string, unknown>) {
  try {
    await signInAnonymously(auth)
  } catch {
    throw new LoginError(
      'Activa el proveedor Anónimo en Firebase Authentication (Consola → Authentication → Sign-in method).',
      'UNKNOWN',
    )
  }

  const user = auth.currentUser
  if (!user) {
    throw new LoginError('No se pudo iniciar sesión', 'UNKNOWN')
  }

  const userRef = doc(db, 'usuarios', cedula)
  await setDoc(doc(db, 'auth_vinculos', user.uid), {
    cedula,
    rol: data.rol,
  })
  await updateDoc(userRef, {
    auth_uid: user.uid,
    authDesincronizado: false,
    passwordTemporal: false,
    claveTemporal: deleteField(),
  })

  return data
}

export async function iniciarSesionConCedula(cedula: string, password: string, recordar = true) {
  await configurarPersistenciaSesion(recordar)

  const email = emailDeCedula(cedula)
  const userRef = doc(db, 'usuarios', cedula)

  const snapPromise = getDoc(userRef)

  let signInOk = false
  try {
    await signInWithEmailAndPassword(auth, email, password)
    signInOk = true
  } catch {
    // Puede ser clave desincronizada tras restablecimiento del director
  }

  let snap
  try {
    snap = await snapPromise
  } catch {
    await signOut(auth).catch(() => {})
    throw new LoginError('Cédula o contraseña incorrecta', 'INVALID_CREDENTIALS')
  }

  if (!snap.exists()) {
    await signOut(auth).catch(() => {})
    throw new LoginError('Usuario no encontrado', 'NOT_FOUND')
  }

  const data = snap.data()

  if (data.password_hash && !signInOk) {
    const hashOk = await verifyPassword(password, data.password_hash)
    if (!hashOk) {
      await signOut(auth).catch(() => {})
      throw new LoginError('Cédula o contraseña incorrecta', 'INVALID_CREDENTIALS')
    }
  }

  if (signInOk) {
    const user = auth.currentUser
    if (!user || user.isAnonymous) {
      await signOut(auth)
      throw new LoginError('Cédula o contraseña incorrecta', 'INVALID_CREDENTIALS')
    }

    const syncTasks: Promise<unknown>[] = []

    if (!data.auth_uid || data.auth_uid !== user.uid) {
      syncTasks.push(updateDoc(userRef, { auth_uid: user.uid }).catch(() => {}))
    }

    syncTasks.push(
      updateDoc(userRef, {
        authDesincronizado: false,
        passwordTemporal: false,
        claveTemporal: deleteField(),
      }).catch(() => {}),
    )

    syncTasks.push(deleteDoc(doc(db, 'auth_vinculos', user.uid)).catch(() => {}))

    if (!data.password_hash) {
      syncTasks.push(
        hashPassword(password).then((hash) =>
          updateDoc(userRef, { password_hash: hash }).catch(() => {}),
        ),
      )
    }

    void Promise.all(syncTasks)

    return data
  }

  if (data.authDesincronizado || data.passwordTemporal) {
    return entrarConSesionAnonima(cedula, data)
  }

  await signOut(auth).catch(() => {})
  throw new LoginError('Cédula o contraseña incorrecta', 'INVALID_CREDENTIALS')
}
