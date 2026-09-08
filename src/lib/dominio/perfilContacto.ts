import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { esCorreoInstitucionalUsc } from '@/lib/dominio/flexibilidadCatalogo'

export interface PerfilContacto {
  celular: string
  correoInstitucional: string
}

const cacheKey = (cedula: string) => `perfil-contacto:${cedula}`

export function correoInstitucionalDesdeCedula(cedula: string): string {
  if (!/^\d+$/.test(cedula)) return ''
  return `${cedula}@usc.edu.co`
}

export function leerContactoPerfilCache(cedula: string): PerfilContacto | null {
  try {
    const raw = localStorage.getItem(cacheKey(cedula))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      celular: (parsed.celular || '').toString(),
      correoInstitucional: (parsed.correoInstitucional || '').toString(),
    }
  } catch {
    return null
  }
}

export function guardarContactoPerfilCache(cedula: string, data: PerfilContacto) {
  try {
    localStorage.setItem(cacheKey(cedula), JSON.stringify(data))
  } catch {
    // ignore
  }
}

function resolverCorreoInstitucional(
  cedula: string,
  data: Record<string, unknown>,
  authEmail?: string | null,
): string {
  const guardado = (data.correo_institucional || '').toString().trim()
  if (esCorreoInstitucionalUsc(guardado)) return guardado

  const correoDoc = (data.correo || '').toString().trim()
  if (esCorreoInstitucionalUsc(correoDoc)) return correoDoc

  const authCorreo = (authEmail || '').trim()
  if (esCorreoInstitucionalUsc(authCorreo)) return authCorreo

  return correoInstitucionalDesdeCedula(cedula)
}

export async function cargarContactoPerfil(cedula: string): Promise<PerfilContacto> {
  const cached = leerContactoPerfilCache(cedula)
  if (cached) return cached

  const fallback: PerfilContacto = {
    celular: '',
    correoInstitucional: correoInstitucionalDesdeCedula(cedula),
  }

  try {
    const snap = await getDoc(doc(db, 'usuarios', cedula))
    if (!snap.exists()) {
      guardarContactoPerfilCache(cedula, fallback)
      return fallback
    }
    const data = snap.data()
    const contacto: PerfilContacto = {
      celular: (data.celular || '').toString().trim(),
      correoInstitucional: resolverCorreoInstitucional(cedula, data, auth.currentUser?.email),
    }
    guardarContactoPerfilCache(cedula, contacto)
    return contacto
  } catch {
    guardarContactoPerfilCache(cedula, fallback)
    return fallback
  }
}

export async function guardarCelularPerfil(cedula: string, celular: string): Promise<void> {
  const limpio = celular.replace(/\D/g, '').trim()
  if (!limpio || limpio.length < 10) {
    throw new Error('Ingresa un número de celular válido (mínimo 10 dígitos).')
  }

  await updateDoc(doc(db, 'usuarios', cedula), { celular: limpio })

  const snap = await getDoc(doc(db, 'usuarios', cedula))
  const data = snap.exists() ? snap.data() : {}
  guardarContactoPerfilCache(cedula, {
    celular: limpio,
    correoInstitucional: resolverCorreoInstitucional(cedula, data, auth.currentUser?.email),
  })
}

export function asuntoSoporteSugerido(nombre: string, cedula: string, rol?: string): string {
  const rolLabel = rol?.trim() || 'Usuario'
  const nombreCorto = nombre.trim() || 'Sin nombre'
  return `Soporte ATAV – ${rolLabel} – ${nombreCorto} – CC ${cedula}`
}
