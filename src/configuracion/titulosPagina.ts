export type PageHeaderInfo = {
  title: string
  subtitle?: string
}

const PAGE_TITLES: Record<string, PageHeaderInfo> = {
  '/perfil': { title: 'Mi Perfil', subtitle: 'Información de tu cuenta' },
  '/perfil/editar': { title: 'Editar perfil', subtitle: 'Actualiza tus datos' },

  '/docente/dashboard': { title: 'Dashboard', subtitle: 'Resumen de actividad' },
  '/docente/crear-solicitud': { title: 'Nueva Solicitud', subtitle: 'Crear solicitud de ausentismo' },
  '/docente/mis-solicitudes': { title: 'Mis Solicitudes', subtitle: 'Historial de solicitudes' },
  '/docente/materias-asignadas': { title: 'Materias asignadas', subtitle: 'Asignaturas a tu cargo' },
  '/docente/notificaciones': { title: 'Notificaciones', subtitle: 'Notificaciones actualizadas' },
  '/docente/recursos': { title: 'Recursos', subtitle: 'Formatos y documentos oficiales' },
  '/docente/calendario': { title: 'Calendario', subtitle: 'Eventos y fechas importantes' },

  '/director': { title: '', subtitle: '' },
  '/director/solicitudes': { title: 'Solicitudes', subtitle: 'Gestionar solicitudes del programa' },
  '/director/reportes': { title: 'Reportes', subtitle: 'Estadísticas y reportes' },
  '/director/notificaciones': { title: 'Notificaciones', subtitle: 'Notificaciones actualizadas' },
  '/director/usuarios': { title: 'Usuarios', subtitle: 'Usuarios registrados' },
  '/director/usuarios/crear': { title: 'Crear usuario', subtitle: 'Registrar nuevo usuario' },
  '/director/materias': { title: 'Materias', subtitle: 'Asignaturas registradas' },
  '/director/parciales': { title: 'Fechas de parciales', subtitle: 'Rangos de fechas por parcial' },
  '/director/llamadas': { title: 'Llamadas', subtitle: 'Llamadas registradas' },
  '/director/aspirantes': { title: 'Aspirantes', subtitle: 'Estudiantes interesados' },
  '/director/recursos': { title: 'Recursos', subtitle: 'Formatos y documentos oficiales' },
  '/director/calendario': { title: 'Calendario', subtitle: 'Eventos y fechas importantes' },

  '/estudiante': { title: '', subtitle: '' },
  '/estudiante/crear-solicitud': { title: 'Nueva Solicitud', subtitle: 'Solicitar excusa académica' },
  '/estudiante/mis-solicitudes': { title: 'Mis Solicitudes', subtitle: 'Estado de tus solicitudes' },
  '/estudiante/notificaciones': { title: 'Notificaciones', subtitle: 'Notificaciones actualizadas' },
  '/estudiante/flexibilidad': { title: 'Flexibilización', subtitle: 'Solicitar flexibilización de parcial' },
  '/estudiante/supletorios': { title: 'Supletorios', subtitle: 'Solicitar examen supletorio' },
  '/estudiante/habilitaciones': { title: 'Habilitaciones', subtitle: 'Solicitar habilitación de materia' },
  '/estudiante/recursos': { title: 'Recursos', subtitle: 'Formatos y documentos oficiales' },
  '/estudiante/calendario': { title: 'Calendario', subtitle: 'Eventos y fechas importantes' },
}

export function headerInfoForPath(path: string): PageHeaderInfo {
  const normalized = path.replace(/\/$/, '') || path

  if (normalized.startsWith('/docente/solicitud/')) {
    return { title: 'Detalle de solicitud', subtitle: 'Información de tu solicitud' }
  }
  if (normalized.startsWith('/director/restablecer-password/')) {
    return { title: 'Restablecer contraseña', subtitle: 'Asignar nueva contraseña al usuario' }
  }
  if (normalized.startsWith('/director/aspirantes/editar/')) {
    return { title: 'Editar aspirante', subtitle: 'Actualizar datos del aspirante' }
  }

  if (PAGE_TITLES[normalized]) return PAGE_TITLES[normalized]

  const prefixKeys = Object.keys(PAGE_TITLES)
    .filter(key => key !== '/director' && key !== '/estudiante')
    .sort((a, b) => b.length - a.length)

  for (const key of prefixKeys) {
    if (normalized === key || normalized.startsWith(`${key}/`)) {
      return PAGE_TITLES[key]
    }
  }

  return { title: '', subtitle: '' }
}

export function mobileBarTitleForPath(path: string, headerTitle: string): string {
  if (headerTitle) return headerTitle
  const normalized = path.replace(/\/$/, '') || path
  if (normalized === '/estudiante' || normalized === '/director' || normalized.startsWith('/docente/dashboard')) {
    return 'Inicio'
  }
  return 'ATAV'
}
