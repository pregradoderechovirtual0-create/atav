export const CAUSAS_FLEXIBILIDAD = [
  { id: 'exterior', label: 'Domicilio en el exterior con diferencia de horario' },
  { id: 'nocturna', label: 'Jornada laboral nocturna en Colombia' },
  { id: 'rural', label: 'Domicilio en zona rural de Colombia' },
  { id: 'salud', label: 'Estado de salud' },
  { id: 'otra', label: 'Otra' },
] as const

export const labelCausaFlexibilidad = (id: string, fallback?: string, detalleOtra?: string): string => {
  if (id === 'otra' && detalleOtra?.trim()) return detalleOtra.trim()
  return CAUSAS_FLEXIBILIDAD.find(c => c.id === id)?.label ?? fallback ?? id
}

export const esCorreoInstitucionalUsc = (correo: string): boolean =>
  /^[^\s@]+@usc\.edu\.co$/i.test(correo.trim())

/** @deprecated Usa labelMateriaPorCodigo con materias de Firestore */
export const labelCursoFlexibilidad = (id: string, fallback?: string): string =>
  fallback ?? id

export const formatFechaParcial = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`
}

export const formatHoraParcial = (h: string | null | undefined): string => {
  if (!h) return '—'
  const hh = parseInt(h.split(':')[0])
  if (hh < 12) return `${h} a. m.`
  if (hh === 12) return '12:00 p. m.'
  return `${hh - 12}:00 p. m.`
}
