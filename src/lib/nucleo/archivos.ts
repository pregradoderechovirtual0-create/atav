/** Tamaño máximo de PDF para solicitudes (5 MB). */
export const MAX_PDF_BYTES = 5 * 1024 * 1024

export const MAX_PDF_MB = 5

export function validarTamanoPdf(archivo: File): string | null {
  if (archivo.size > MAX_PDF_BYTES) {
    return `El PDF supera ${MAX_PDF_MB} MB. Reduce el tamaño del archivo e intenta de nuevo.`
  }
  return null
}

export function esPdfValido(archivo: File): boolean {
  return archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf')
}
