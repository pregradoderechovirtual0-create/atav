import { dialog } from '@/lib/dialog'

export interface DatosConfirmacionEstudiante {
  nombre: string
  cedula: string
}

export interface DetalleConfirmacionSolicitud {
  label: string
  value: string
}

export interface PayloadConfirmacionSolicitud {
  tipo: string
  detalles: DetalleConfirmacionSolicitud[]
}

export async function confirmarSolicitudEstudiante(
  estudiante: DatosConfirmacionEstudiante,
  payload: PayloadConfirmacionSolicitud,
  options?: { titulo?: string },
): Promise<boolean> {
  return dialog.confirmSolicitud({
    nombre: estudiante.nombre?.trim() || '—',
    cedula: estudiante.cedula?.trim() || '—',
    tipo: payload.tipo,
    detalles: payload.detalles,
    titulo: options?.titulo || 'Confirmar envío',
  })
}
