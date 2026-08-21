/** Primeros dos nombres para saludos (ej. "María Fernanda García López" → "María Fernanda"). */
export function primerosDosNombres(nombre: string | null | undefined): string {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return ''
  if (partes.length <= 2) return partes.join(' ')
  return partes.slice(0, 2).join(' ')
}
