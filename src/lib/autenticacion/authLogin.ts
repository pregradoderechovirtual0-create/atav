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
import { hashPassword, verifyPassword } from '@/lib/autenticacion/passwordUtils'
import { sincronizarIndiceDirectorUid } from '@/lib/autenticacion/directorUidIndex'
import { esRolDirector } from '@/lib/nucleo/roles'

export class LoginError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_CREDENTIALS' | 'NOT_FOUND' | 'UNKNOWN' = 'UNKNOWN',
  ) {
    super(message)
  }
}

const emailDeCedula = (cedula: string) => `${cedula}@atav.com`

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function configurarPersistenciaSesion(recordar: boolean) {
  await setPersistence(auth, recordar ? browserLocalPersistence : browserSessionPersistence)
}

async function signInConReintentos(email: string, password: string, intentos = 3): Promise<boolean> {
  for (let i = 0; i < intentos; i++) {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch {
      if (i < intentos - 1) await sleep(200 * (i + 1))
    }
  }
  return false
}

async function signInConUnIntento(email: string, password: string): Promise<boolean> {
  try {
    await signInWithEmailAndPassword(auth, email, password)
    return true
  } catch {
    return false
  }
}

async function leerPerfilUsuario(cedula: string) {
  const userRef = doc(db, 'usuarios', cedula)
  const snap = await getDoc(userRef)
  if (!snap.exists()) {
    throw new LoginError('Usuario no encontrado', 'NOT_FOUND')
  }
  return { userRef, data: snap.data() }
}

async function intentarLeerPerfil(cedula: string) {
  try {
    return await leerPerfilUsuario(cedula)
  } catch (error) {
    if (error instanceof LoginError && error.code === 'NOT_FOUND') throw error
    return null
  }
}

async function verificarPasswordFirestore(data: Record<string, unknown>, password: string) {
  if (!data.password_hash) return false
  return verifyPassword(password, data.password_hash as string)
}

function requiereLoginPorHash(data: Record<string, unknown>) {
  return data.authDesincronizado === true || data.passwordTemporal === true
}

function validarCuentaActivada(data: Record<string, unknown>) {
  if (data.registrado === false) {
    throw new LoginError(
      'Tu cuenta aún no está activada. Usa "Activa tu cuenta" para crear tu contraseña.',
      'INVALID_CREDENTIALS',
    )
  }
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
    passwordTemporal: false,
    claveTemporal: deleteField(),
  })

  return data
}

async function sincronizarTrasLogin(
  userRef: ReturnType<typeof doc>,
  data: Record<string, unknown>,
  password: string,
) {
  const user = auth.currentUser
  if (!user || user.isAnonymous) {
    await signOut(auth).catch(() => {})
    throw new LoginError('Cédula o contraseña incorrecta', 'INVALID_CREDENTIALS')
  }

  const syncTasks: Promise<unknown>[] = []

  if (!data.auth_uid || data.auth_uid !== user.uid) {
    syncTasks.push(
      updateDoc(userRef, { auth_uid: user.uid }).catch(err => {
        console.warn('No se pudo vincular auth_uid en Firestore:', err)
      }),
    )
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
      hashPassword(password).then(hash =>
        updateDoc(userRef, { password_hash: hash }).catch(() => {}),
      ),
    )
  }

  const rol = (data.rol || '').toString()
  const cedulaPerfil = userRef.id
  if (esRolDirector(rol) && user.uid) {
    syncTasks.push(
      sincronizarIndiceDirectorUid(user.uid, rol, cedulaPerfil).catch(() => {}),
    )
  }

  await Promise.all(syncTasks)
}

async function entrarConFirebaseEmail(
  email: string,
  password: string,
  userRef: ReturnType<typeof doc>,
  data: Record<string, unknown>,
  reintentos = 3,
) {
  const signInOk = await signInConReintentos(email, password, reintentos)
  if (!signInOk) {
    throw new LoginError('Cédula o contraseña incorrecta', 'INVALID_CREDENTIALS')
  }

  validarCuentaActivada(data)
  await sincronizarTrasLogin(userRef, data, password)
  return data
}

export async function iniciarSesionConCedula(cedula: string, password: string, recordar = true) {
  await auth.authStateReady()

  if (auth.currentUser) {
    await signOut(auth)
  }

  await configurarPersistenciaSesion(recordar)

  const email = emailDeCedula(cedula)
  const perfil = await intentarLeerPerfil(cedula)

  if (perfil) {
    const { userRef, data } = perfil
    validarCuentaActivada(data)

    if (data.password_hash) {
      const hashOk = await verificarPasswordFirestore(data, password)
      if (!hashOk) {
        throw new LoginError('Cédula o contraseña incorrecta', 'INVALID_CREDENTIALS')
      }

      if (requiereLoginPorHash(data)) {
        return entrarConSesionAnonima(cedula, data)
      }

      if (await signInConUnIntento(email, password)) {
        await sincronizarTrasLogin(userRef, data, password)
        return data
      }

      return entrarConSesionAnonima(cedula, data)
    }

    return entrarConFirebaseEmail(email, password, userRef, data)
  }

  if (await signInConReintentos(email, password)) {
    const perfilAutenticado = await leerPerfilUsuario(cedula)
    validarCuentaActivada(perfilAutenticado.data)
    await sincronizarTrasLogin(perfilAutenticado.userRef, perfilAutenticado.data, password)
    return perfilAutenticado.data
  }

  throw new LoginError('Cédula o contraseña incorrecta', 'INVALID_CREDENTIALS')
}
