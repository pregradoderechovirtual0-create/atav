import { signOut } from 'firebase/auth'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { esRolDirector } from '@/lib/nucleo/roles'
import { limpiarCachesApp } from '@/lib/nucleo/appCache'

export interface SesionUsuario {
  cedula: string
  rol: string
  uid: string
  nombre: string
}

export type MotivoSesionInvalida = 'sin_sesion' | 'password_restablecida' | 'usuario_inactivo'

export type ResultadoValidacionSesion =
  | { valida: true; sesion: SesionUsuario }
  | { valida: false; motivo: MotivoSesionInvalida }

const MOTIVO_CIERRE_KEY = 'atav-logout-motivo'

export function marcarMotivoCierreSesion(motivo: Exclude<MotivoSesionInvalida, 'sin_sesion'>) {
  sessionStorage.setItem(MOTIVO_CIERRE_KEY, motivo)
}

export function consumirMotivoCierreSesion(): MotivoSesionInvalida | null {
  const motivo = sessionStorage.getItem(MOTIVO_CIERRE_KEY)
  sessionStorage.removeItem(MOTIVO_CIERRE_KEY)
  if (motivo === 'password_restablecida' || motivo === 'usuario_inactivo') return motivo
  return null
}

export function mensajeMotivoCierreSesion(motivo: MotivoSesionInvalida): string {
  if (motivo === 'password_restablecida') {
    return 'Tu contraseña fue restablecida. Inicia sesión con la nueva clave asignada.'
  }
  if (motivo === 'usuario_inactivo') {
    return 'Tu cuenta ya no está activa. Contacta a administración.'
  }
  return ''
}

let authListo = false
let promesaAuth: Promise<void> | null = null

export function esperarAuth(): Promise<void> {
  if (authListo) return Promise.resolve()
  if (!promesaAuth) {
    promesaAuth = auth.authStateReady().then(() => {
      authListo = true
    })
  }
  return promesaAuth
}

function sesionDesdeLocal(uid: string): SesionUsuario | null {
  const cedula = localStorage.getItem('cedula') || ''
  const rol = localStorage.getItem('rol') || ''
  if (!cedula || !rol) return null

  return {
    cedula,
    rol,
    uid,
    nombre: localStorage.getItem('nombre') || '',
  }
}

async function sesionDesdeVinculo(uid: string): Promise<SesionUsuario | null> {
  try {
    const vinculoSnap = await getDoc(doc(db, 'auth_vinculos', uid))
    if (!vinculoSnap.exists()) return sesionDesdeLocal(uid)

    const cedula = (vinculoSnap.data().cedula || '').toString()
    if (!/^\d+$/.test(cedula)) return sesionDesdeLocal(uid)

    const snap = await getDoc(doc(db, 'usuarios', cedula))
    if (!snap.exists()) return sesionDesdeLocal(uid)

    const data = snap.data()
    if (data.auth_uid && data.auth_uid !== uid) return null

    const rol = (data.rol || vinculoSnap.data().rol || '').toString()
    if (!rol) return null

    return {
      cedula,
      rol,
      uid,
      nombre: (data.nombre || '').toString(),
    }
  } catch {
    return sesionDesdeLocal(uid)
  }
}

export async function obtenerSesion(): Promise<SesionUsuario | null> {
  const validacion = await validarSesionConServidor()
  return validacion.valida ? validacion.sesion : null
}

export async function validarSesionConServidor(): Promise<ResultadoValidacionSesion> {
  await esperarAuth()

  const user = auth.currentUser
  if (!user) return { valida: false, motivo: 'sin_sesion' }

  try {
    let cedula = ''

    if (user.isAnonymous) {
      const vinculoSnap = await getDoc(doc(db, 'auth_vinculos', user.uid))
      if (!vinculoSnap.exists()) return { valida: false, motivo: 'usuario_inactivo' }
      cedula = (vinculoSnap.data().cedula || '').toString()
    } else {
      cedula = user.email?.split('@')[0] || ''
    }

    if (!/^\d+$/.test(cedula)) return { valida: false, motivo: 'usuario_inactivo' }

    const snap = await getDoc(doc(db, 'usuarios', cedula))
    if (!snap.exists()) return { valida: false, motivo: 'usuario_inactivo' }

    const data = snap.data()

    if (data.registrado === false) return { valida: false, motivo: 'usuario_inactivo' }
    if (data.passwordTemporal === true) return { valida: false, motivo: 'password_restablecida' }

    const rol = (data.rol || '').toString()
    if (!rol) return { valida: false, motivo: 'usuario_inactivo' }

    return {
      valida: true,
      sesion: {
        cedula,
        rol,
        uid: user.uid,
        nombre: (data.nombre || '').toString(),
      },
    }
  } catch {
    const sesionLocal = sesionDesdeLocal(user.uid)
    if (sesionLocal) return { valida: true, sesion: sesionLocal }
    return { valida: false, motivo: 'sin_sesion' }
  }
}

export function sincronizarSesionLocal(sesion: SesionUsuario) {
  localStorage.setItem('rol', sesion.rol)
  localStorage.setItem('cedula', sesion.cedula)
  localStorage.setItem('uid', sesion.uid)
  if (sesion.nombre?.trim()) localStorage.setItem('nombre', sesion.nombre.trim())
}

export function leerNombreLocal(): string {
  return localStorage.getItem('nombre') || ''
}

export async function cerrarSesion() {
  const uid = auth.currentUser?.uid

  localStorage.removeItem('rol')
  localStorage.removeItem('cedula')
  localStorage.removeItem('uid')
  localStorage.removeItem('nombre')
  limpiarCachesApp(uid)

  if (uid) {
    deleteDoc(doc(db, 'auth_vinculos', uid)).catch(() => {})
  }

  try {
    await Promise.race([
      signOut(auth),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ])
  } catch {
    // Extensiones del navegador pueden bloquear el canal de Firestore al cerrar sesión.
  }

  localStorage.removeItem('rol')
  localStorage.removeItem('cedula')
  localStorage.removeItem('uid')
  localStorage.removeItem('nombre')
}

export function puedeAccederRuta(rol: string, path: string): boolean {
  if (path.startsWith('/perfil')) return true
  if (path.startsWith('/director')) return esRolDirector(rol)
  if (path.startsWith('/docente')) return rol === 'Docente'
  if (path.startsWith('/estudiante')) return rol === 'Estudiante'
  return false
}
