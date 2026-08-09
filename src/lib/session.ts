import { signOut } from 'firebase/auth'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { esRolDirector } from '@/lib/roles'
import { limpiarCachesApp } from '@/lib/appCache'

export interface SesionUsuario {
  cedula: string
  rol: string
  uid: string
  nombre: string
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
  await esperarAuth()

  const user = auth.currentUser
  if (!user) return null

  if (user.isAnonymous) {
    return sesionDesdeVinculo(user.uid)
  }

  const cedula = user.email?.split('@')[0] || ''
  if (!/^\d+$/.test(cedula)) return null

  try {
    const snap = await getDoc(doc(db, 'usuarios', cedula))
    if (!snap.exists()) return sesionDesdeLocal(user.uid)

    const data = snap.data()
    if (data.auth_uid && data.auth_uid !== user.uid) return null

    const rol = (data.rol || '').toString()
    if (!rol) return null

    return {
      cedula,
      rol,
      uid: user.uid,
      nombre: (data.nombre || '').toString(),
    }
  } catch {
    return sesionDesdeLocal(user.uid)
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
