import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ParcialRango {
  inicio: string
  fin: string
}

export interface ConfigParciales {
  periodo: string
  notas: string
  parcial_1: ParcialRango | null
  parcial_2: ParcialRango | null
  parcial_3: ParcialRango | null
}

const DOC_REF = doc(db, 'parciales', 'rangos')

export const configParcialesVacia = (): ConfigParciales => ({
  periodo: '',
  notas: '',
  parcial_1: null,
  parcial_2: null,
  parcial_3: null,
})

export const cargarConfigParciales = async (): Promise<ConfigParciales> => {
  const snap = await getDoc(DOC_REF)
  if (!snap.exists()) return configParcialesVacia()
  const d = snap.data()
  return {
    periodo: (d.periodo as string) || '',
    notas: (d.notas as string) || '',
    parcial_1: d.parcial_1?.inicio && d.parcial_1?.fin ? d.parcial_1 : null,
    parcial_2: d.parcial_2?.inicio && d.parcial_2?.fin ? d.parcial_2 : null,
    parcial_3: d.parcial_3?.inicio && d.parcial_3?.fin ? d.parcial_3 : null,
  }
}

export const guardarConfigParciales = async (config: ConfigParciales) => {
  await setDoc(DOC_REF, {
    ...config,
    actualizado_en: serverTimestamp(),
  })
}

export const getRangoParcial = (config: ConfigParciales, parcialId: string): ParcialRango | null => {
  const key = `parcial_${parcialId}` as keyof ConfigParciales
  return config[key] ?? null
}

/** Ventana seleccionable: 1 semana antes del inicio hasta el fin del parcial */
export const getVentanaSeleccion = (rango: ParcialRango | null): ParcialRango | null => {
  if (!rango?.inicio || !rango?.fin) return null
  const inicio = new Date(rango.inicio + 'T12:00:00')
  inicio.setDate(inicio.getDate() - 7)
  return {
    inicio: inicio.toISOString().split('T')[0],
    fin: rango.fin,
  }
}

export const hoyIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** ¿Hoy está dentro de la ventana para solicitar este parcial? */
export const parcialAbiertoHoy = (config: ConfigParciales, parcialId: string): boolean => {
  const ventana = getVentanaSeleccion(getRangoParcial(config, parcialId))
  if (!ventana) return false
  const hoy = hoyIso()
  return hoy >= ventana.inicio && hoy <= ventana.fin
}

export const mensajeEstadoParcial = (config: ConfigParciales, parcialId: string): string => {
  const rango = getRangoParcial(config, parcialId)
  if (!rango) return 'Sin fechas configuradas'
  const ventana = getVentanaSeleccion(rango)
  if (!ventana) return 'Sin fechas configuradas'
  const hoy = hoyIso()
  if (hoy < ventana.inicio) {
    return `Disponible a partir del ${formatFechaCorta(ventana.inicio)}`
  }
  if (hoy > ventana.fin) return 'Periodo cerrado'
  return `Abierto hasta el ${formatFechaCorta(ventana.fin)}`
}

export const fechaEnVentana = (iso: string, ventana: ParcialRango | null): boolean => {
  if (!ventana) return false
  return iso >= ventana.inicio && iso <= ventana.fin
}

export const formatRango = (rango: ParcialRango | null): string => {
  if (!rango) return 'Sin configurar'
  return `${formatFechaCorta(rango.inicio)} — ${formatFechaCorta(rango.fin)}`
}

export const formatFechaCorta = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
}
