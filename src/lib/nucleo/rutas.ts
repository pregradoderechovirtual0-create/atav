export const rutaInicioPorRol = (rol: string | null | undefined): string => {
  const rutas: Record<string, string> = {
    Director: '/director',
    'Jefa Suprema': '/director',
    Docente: '/docente/dashboard',
    Estudiante: '/estudiante',
  }
  return rutas[rol || ''] || '/'
}
