import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export class ReactivarCuentaError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'ALREADY_INACTIVE' = 'NOT_FOUND',
  ) {
    super(message)
    this.name = 'ReactivarCuentaError'
  }
}

/**
 * Reactiva la cuenta sin borrar datos del perfil (nombre, rol, correo, etc.).
 * Solo resetea el acceso: el usuario debe ir a «Activa tu cuenta» y crear una contraseña nueva.
 */
export async function reactivarCuentaUsuario(cedula: string): Promise<void> {
  const ref = doc(db, 'usuarios', cedula)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new ReactivarCuentaError('Usuario no encontrado', 'NOT_FOUND')
  }

  const data = snap.data()
  if (data.registrado === false && !data.password_hash) {
    throw new ReactivarCuentaError(
      'Esta cuenta ya está pendiente de activación. El usuario debe usar «Activa tu cuenta».',
      'ALREADY_INACTIVE',
    )
  }

  await updateDoc(ref, {
    registrado: false,
    password_hash: deleteField(),
    passwordTemporal: false,
    requiereCambioPassword: false,
    claveTemporal: deleteField(),
    authDesincronizado: false,
    reactivacionPendiente: true,
  })
}
