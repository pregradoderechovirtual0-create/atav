import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface MateriaRegistrada {
  id: string
  codigo: string
  nombre: string
  semestre?: string
  dia?: string
  hora?: string
  profesor?: string
}

export const labelMateria = (
  materia: Pick<MateriaRegistrada, 'codigo' | 'nombre'> | null | undefined,
  fallback = '—',
): string => {
  if (!materia?.codigo || !materia?.nombre) return fallback
  return `${materia.codigo} — ${materia.nombre}`
}

export const labelMateriaPorCodigo = (
  codigo: string,
  materias: MateriaRegistrada[],
  fallback?: string,
): string => {
  const materia = materias.find(m => m.codigo === codigo || m.id === codigo)
  return materia ? labelMateria(materia) : (fallback ?? codigo)
}

export async function fetchMaterias(): Promise<MateriaRegistrada[]> {
  const snap = await getDocs(collection(db, 'materias'))
  return snap.docs
    .map(docSnap => {
      const data = docSnap.data()
      const codigo = (data.codigo || docSnap.id).toString().trim()
      return {
        id: docSnap.id,
        codigo,
        nombre: (data.nombre || '').toString().trim(),
        semestre: data.semestre?.toString(),
        dia: data.dia,
        hora: data.hora,
        profesor: data.profesor,
      }
    })
    .filter(m => m.codigo && m.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function filtrarMateriasPorProfesor(
  materias: MateriaRegistrada[],
  nombreProfesor: string,
): MateriaRegistrada[] {
  const nombre = nombreProfesor.trim().toLowerCase()
  if (!nombre) return []
  return materias.filter(m => m.profesor?.trim().toLowerCase() === nombre)
}

export function filtrarMaterias(
  materias: MateriaRegistrada[],
  busqueda: string,
): MateriaRegistrada[] {
  const q = busqueda.trim().toLowerCase()
  if (!q) return materias
  return materias.filter(
    m =>
      m.codigo.toLowerCase().includes(q) ||
      m.nombre.toLowerCase().includes(q),
  )
}

const semestreOrden = (semestre?: string) => {
  const match = semestre?.match(/\d+/)
  return match ? parseInt(match[0], 10) : 999
}

export interface MateriaGrupoSemestre {
  semestre: string
  items: MateriaRegistrada[]
}

export function agruparMateriasPorSemestre(materias: MateriaRegistrada[]): MateriaGrupoSemestre[] {
  const map = new Map<string, MateriaRegistrada[]>()
  for (const m of materias) {
    const key = m.semestre?.trim() || 'Sin semestre asignado'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return Array.from(map.entries())
    .sort((a, b) => semestreOrden(a[0]) - semestreOrden(b[0]))
    .map(([semestre, items]) => ({
      semestre,
      items: items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    }))
}
