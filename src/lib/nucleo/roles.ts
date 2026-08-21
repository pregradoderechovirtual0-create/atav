export const ROL_DIRECTOR = 'Director'
export const ROL_JEFA_SUPREMA = 'Jefa Suprema'

export const ROLES_DIRECTOR = [ROL_DIRECTOR, ROL_JEFA_SUPREMA] as const

const LABELS_ROL: Record<string, string> = {
  [ROL_DIRECTOR]: 'Practicante',
  [ROL_JEFA_SUPREMA]: 'Directora',
}

/** Nombre visible del rol (sin cambiar el valor guardado en Firebase). */
export function labelRol(rol: string | null | undefined): string {
  if (!rol) return ''
  return LABELS_ROL[rol] ?? rol
}

export function esRolDirector(rol: string | null | undefined): boolean {
  return rol === ROL_DIRECTOR || rol === ROL_JEFA_SUPREMA
}

export function mapRolMenu(rol: string): 'docente' | 'director' | 'estudiante' {
  if (rol === 'Docente') return 'docente'
  if (esRolDirector(rol)) return 'director'
  return 'estudiante'
}
