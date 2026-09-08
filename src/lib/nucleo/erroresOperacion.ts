import { dialog } from '@/lib/nucleo/dialog'
import { MAX_PDF_MB, validarTamanoPdf } from '@/lib/nucleo/archivos'

export function hayConexion(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function codigoErrorFirebase(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: string }).code)
  }
  return ''
}

export function esErrorDeRed(error: unknown): boolean {
  if (!hayConexion()) return true
  const code = codigoErrorFirebase(error)
  return ['unavailable', 'deadline-exceeded', 'network-request-failed', 'cancelled'].includes(code)
}

export function mensajeErrorEnvio(error: unknown, contexto = 'enviar la solicitud'): string {
  if (!hayConexion()) {
    return 'No hay conexión a internet. Tus datos siguen en el formulario; cuando vuelva la red, intenta enviar de nuevo.'
  }
  const code = codigoErrorFirebase(error)
  if (code === 'permission-denied') {
    return 'No tienes permiso para guardar. Cierra sesión e ingresa de nuevo, o contacta a la institución.'
  }
  if (esErrorDeRed(error)) {
    return 'No se pudo contactar al servidor. Revisa tu conexión e intenta otra vez.'
  }
  if (error instanceof Error && error.message && !error.message.includes('Firebase')) {
    return error.message
  }
  return `No se pudo ${contexto}. Intenta de nuevo en unos segundos.`
}

export async function alertaSinConexion(): Promise<void> {
  await dialog.alert(
    'No hay conexión a internet. Tus datos del formulario se conservan. Cuando vuelva la red, podrás enviar de nuevo.',
    { variant: 'error', title: 'Sin conexión' },
  )
}

export async function confirmarReintento(mensaje: string): Promise<boolean> {
  return dialog.confirm(mensaje, {
    title: 'No se pudo enviar',
    confirmText: 'Reintentar',
    cancelText: 'Quedarme aquí',
    variant: 'error',
  })
}

export async function subirPdfCloudinary(archivo: File): Promise<string> {
  if (!hayConexion()) {
    throw new Error('Sin conexión para subir el PDF.')
  }

  const tamanoError = validarTamanoPdf(archivo)
  if (tamanoError) {
    throw new Error(tamanoError)
  }

  const fd = new FormData()
  fd.append('file', archivo)
  fd.append('upload_preset', 'flexibilizaciones_pdf')

  let res: Response
  try {
    res = await fetch('https://api.cloudinary.com/v1_1/dhbehhvb5/image/upload', {
      method: 'POST',
      body: fd,
    })
  } catch {
    throw new Error('No se pudo subir el PDF. Revisa tu conexión e intenta de nuevo.')
  }

  if (!res.ok) {
    throw new Error('El servicio de archivos no respondió. Intenta de nuevo en unos segundos.')
  }

  const data = await res.json()
  if (!data.secure_url) {
    throw new Error('No se recibió la URL del PDF. Verifica que sea un PDF válido (máx. 5 MB).')
  }

  return String(data.secure_url)
}
