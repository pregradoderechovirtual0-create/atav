export type CodigoErrorApp = '401' | '403' | '404' | '500' | '503' | 'offline'

export interface ErrorAppMeta {
  code: CodigoErrorApp
  titulo: string
  descripcion: string
  hint?: string
}

const ERRORES: Record<CodigoErrorApp, ErrorAppMeta> = {
  '401': {
    code: '401',
    titulo: 'Sesión expirada',
    descripcion: 'Tu sesión ya no es válida. Inicia sesión de nuevo para continuar.',
    hint: 'Si acabas de cerrar sesión en otra pestaña, esto es normal.',
  },
  '403': {
    code: '403',
    titulo: 'Acceso no permitido',
    descripcion: 'No tienes permiso para ver esta sección con tu rol actual.',
    hint: 'Si crees que es un error, contacta a Derecho Virtual.',
  },
  '404': {
    code: '404',
    titulo: 'Página no encontrada',
    descripcion: 'La ruta que intentas visitar no existe o fue movida.',
    hint: 'Verifica la dirección o usa el menú lateral para navegar.',
  },
  '500': {
    code: '500',
    titulo: 'Algo salió mal',
    descripcion: 'Ocurrió un error inesperado al cargar esta página.',
    hint: 'Recarga la página o vuelve al inicio. Si persiste, contacta soporte.',
  },
  '503': {
    code: '503',
    titulo: 'Servicio no disponible',
    descripcion: 'El sistema no responde en este momento. Puede ser mantenimiento o una caída temporal.',
    hint: 'Intenta en unos minutos. Si urgente, contacta derechovirtual@usc.edu.co',
  },
  offline: {
    code: 'offline',
    titulo: 'Sin conexión',
    descripcion: 'No hay internet o no se puede contactar al servidor.',
    hint: 'Revisa tu conexión y vuelve a intentar.',
  },
}

export function metaErrorApp(code: string | undefined | null): ErrorAppMeta {
  const c = (code || '404').toString().toLowerCase()
  if (c === 'offline' || c === 'network') return ERRORES.offline
  if (c in ERRORES) return ERRORES[c as CodigoErrorApp]
  const num = parseInt(c, 10)
  if (num === 401) return ERRORES['401']
  if (num === 403) return ERRORES['403']
  if (num === 503) return ERRORES['503']
  if (num >= 500) return ERRORES['500']
  return ERRORES['404']
}

export function esCodigoErrorApp(code: string): code is CodigoErrorApp {
  return ['401', '403', '404', '500', '503', 'offline'].includes(code)
}
