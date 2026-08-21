export const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const DIAS_SEMANA_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const HORARIOS_MANANA = ['08:00', '09:00', '10:00', '11:00']
export const HORARIOS_TARDE = ['14:00', '15:00', '16:00', '17:00']

export interface CeldaCalendario {
  dia: number
  iso: string
}

export const isoDesdePartes = (anio: number, mes: number, dia: number) =>
  `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

export const esDiaHabilitado = (iso: string, min?: string, max?: string) => {
  if (min && iso < min) return false
  if (max && iso > max) return false
  return true
}

export const construirDiasCalendario = (
  mes: number,
  anio: number,
  min?: string,
  max?: string,
): (CeldaCalendario | null)[] => {
  const primerDiaSemana = new Date(anio, mes, 1).getDay()
  const totalDias = new Date(anio, mes + 1, 0).getDate()
  const celdas: (CeldaCalendario | null)[] = []

  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null)

  for (let d = 1; d <= totalDias; d++) {
    const iso = isoDesdePartes(anio, mes, d)
    celdas.push({ dia: d, iso })
  }
  return celdas
}

export const formatFechaLegible = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  const meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${parseInt(d, 10)} de ${meses[parseInt(m, 10)]} de ${y}`
}

export const formatHoraLegible = (h: string) => {
  if (!h) return '—'
  const [hhStr, mmStr] = h.split(':')
  const hh = parseInt(hhStr, 10)
  const mm = mmStr || '00'
  if (hh < 12) return `${hh}:${mm} a. m.`
  if (hh === 12) return `12:${mm} p. m.`
  return `${hh - 12}:${mm} p. m.`
}

export const parseDatetimeLocal = (valor: string) => {
  if (!valor || !valor.includes('T')) return { fecha: '', hora: '' }
  const [fecha, hora] = valor.split('T')
  return { fecha, hora: hora.slice(0, 5) }
}

export const toDatetimeLocal = (fecha: string, hora: string) =>
  fecha && hora ? `${fecha}T${hora}` : ''

export const sumarDiasIso = (iso: string, dias: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return isoDesdePartes(d.getFullYear(), d.getMonth(), d.getDate())
}
