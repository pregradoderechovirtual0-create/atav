<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'
import AppDialog from './components/AppDialog.vue'
import { applyThemeForRole } from '@/lib/theme'
import { obtenerSesion } from '@/lib/session'
import { useSidebar } from '@/composables/useSidebar'
import { useNetworkStatus } from '@/composables/useNetworkStatus'
import { useRouteStyles } from '@/composables/useRouteStyles'

const route = useRoute()
const { isMobile, openMobileMenu } = useSidebar()
useNetworkStatus()
useRouteStyles(route)

onMounted(async () => {
  try {
    const sesion = await obtenerSesion()
    applyThemeForRole(sesion?.rol ?? null)
  } catch {
    applyThemeForRole(localStorage.getItem('rol'))
  }
})

const isLoginPage = computed(() => {
  return route.path === '/' || route.path === '/registro'
})

const isErrorPage = computed(() => route.name === 'error' || route.path.startsWith('/error/'))

const headerInfo = computed(() => {
  const path = route.path.replace(/\/$/, '') || route.path

  if (path.startsWith('/docente/solicitud/')) {
    return { title: 'Detalle de solicitud', subtitle: 'Información de tu solicitud' }
  }
  if (path.startsWith('/director/restablecer-password/')) {
    return { title: 'Restablecer contraseña', subtitle: 'Asignar nueva contraseña al usuario' }
  }
  if (path.startsWith('/director/aspirantes/editar/')) {
    return { title: 'Editar aspirante', subtitle: 'Actualizar datos del aspirante' }
  }

  const titles: Record<string, { title: string; subtitle?: string }> = {
    // Perfil
    '/perfil': { title: 'Mi Perfil', subtitle: 'Información de tu cuenta' },
    '/perfil/editar': { title: 'Editar perfil', subtitle: 'Actualiza tus datos' },

    // DOCENTE
    '/docente/dashboard': { title: 'Dashboard', subtitle: 'Resumen de actividad' },
    '/docente/crear-solicitud': { title: 'Nueva Solicitud', subtitle: 'Crear solicitud de ausentismo' },
    '/docente/mis-solicitudes': { title: 'Mis Solicitudes', subtitle: 'Historial de solicitudes' },
    '/docente/materias-asignadas': { title: 'Materias asignadas', subtitle: 'Asignaturas a tu cargo' },
    '/docente/notificaciones': { title: 'Notificaciones', subtitle: 'Notificaciones actualizadas' },
    '/docente/recursos': { title: 'Recursos', subtitle: 'Formatos y documentos oficiales' },

    // DIRECTOR
    '/director': { title: '', subtitle: '' },
    '/director/solicitudes': { title: 'Solicitudes', subtitle: 'Gestionar solicitudes del programa' },
    '/director/reportes': { title: 'Reportes', subtitle: 'Estadisticas y reportes' },
    '/director/notificaciones': {title: 'Notificaciones', subtitle: 'Notificaciones actualizadas'},
    '/director/usuarios': { title: 'Usuarios', subtitle: 'Usuarios registrados' },
    '/director/usuarios/crear': { title: 'Crear usuario', subtitle: 'Registrar nuevo usuario' },
    '/director/materias': {title: 'Materias', subtitle: 'Asignaturas registradas'},
    '/director/parciales': { title: 'Fechas de parciales', subtitle: 'Rangos de fechas por parcial' },
    '/director/llamadas': {title: 'Llamadas', subtitle: 'Llamadas registradas'},
    '/director/aspirantes': {title: 'Aspirantes', subtitle: 'Estudiantes interesados'},
    '/director/recursos': { title: 'Recursos', subtitle: 'Formatos y documentos oficiales' },

    // Calendario
    '/director/calendario': { title: 'Calendario', subtitle: 'Eventos y fechas importantes' },
    '/docente/calendario': { title: 'Calendario', subtitle: 'Eventos y fechas importantes' },
    '/estudiante/calendario': { title: 'Calendario', subtitle: 'Eventos y fechas importantes' },

    // ESTUDIANTE
    '/estudiante': { title: '', subtitle: '' },
    '/estudiante/crear-solicitud': { title: 'Nueva Solicitud', subtitle: 'Solicitar excusa academica' },
    '/estudiante/mis-solicitudes': { title: 'Mis Solicitudes', subtitle: 'Estado de tus solicitudes' },
    '/estudiante/notificaciones': { title: 'Notificaciones', subtitle: 'Notificaciones actualizadas' },
    '/estudiante/flexibilidad': { title: 'Flexibilización', subtitle: 'Solicitar flexibilización de parcial' },
    '/estudiante/supletorios': { title: 'Supletorios', subtitle: 'Solicitar examen supletorio' },
    '/estudiante/habilitaciones': { title: 'Habilitaciones', subtitle: 'Solicitar habilitación de materia' },
    '/estudiante/recursos': { title: 'Recursos', subtitle: 'Formatos y documentos oficiales' },

  }

  if (titles[path]) return titles[path]

  const prefixKeys = Object.keys(titles)
    .filter(k => k !== '/director' && k !== '/estudiante')
    .sort((a, b) => b.length - a.length)

  for (const key of prefixKeys) {
    if (path === key || path.startsWith(`${key}/`)) {
      return titles[key]
    }
  }

  return { title: '', subtitle: '' }
})

const mobileBarTitle = computed(() => {
  if (headerInfo.value.title) return headerInfo.value.title
  const path = route.path.replace(/\/$/, '') || route.path
  if (path === '/estudiante' || path === '/director' || path.startsWith('/docente/dashboard')) {
    return 'Inicio'
  }
  return 'ATAV'
})
</script>

<template>
  <div v-if="isLoginPage || isErrorPage" class="login-wrapper">
    <router-view />
  </div>
  <div v-else class="app-layout" :class="{ 'app-layout--mobile': isMobile }">
    <Sidebar />
    <div class="main-area">
      <header v-if="isMobile" class="mobile-topbar">
        <button
          type="button"
          class="mobile-menu-btn"
          aria-label="Abrir menú"
          @click="openMobileMenu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="4" y1="7" x2="20" y2="7"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="17" x2="20" y2="17"/>
          </svg>
        </button>
        <span class="mobile-topbar-title">{{ mobileBarTitle }}</span>
        <div class="mobile-topbar-actions">
          <Header compact />
        </div>
      </header>
      <main class="main-content" :class="{ 'main-content--with-mobile-bar': isMobile }">
        <div
          v-if="!isMobile"
          class="view-header"
          :class="{ 'view-header--actions-only': !headerInfo.title }"
        >
          <div v-if="headerInfo.title" class="page-heading">
            <h1 class="page-heading-title">{{ headerInfo.title }}</h1>
            <p v-if="headerInfo.subtitle" class="page-heading-subtitle">{{ headerInfo.subtitle }}</p>
          </div>
          <Header />
        </div>
        <div
          v-else-if="headerInfo.title && headerInfo.subtitle"
          class="mobile-page-subtitle"
        >
          <p>{{ headerInfo.subtitle }}</p>
        </div>
        <router-view />
      </main>
    </div>
  </div>
  <AppDialog />
</template>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
}

.app-layout {
  display: flex;
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: var(--sidebar-width, 240px);
  background: var(--color-background);
  transition: margin-left 0.3s ease;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

.main-content {
  flex: 1;
  padding: 24px;
  width: 100%;
  max-width: min(1400px, 100%);
  min-width: 0;
  position: relative;
  box-sizing: border-box;
  overflow-x: hidden;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.view-header--actions-only {
  position: absolute;
  top: 24px;
  right: 24px;
  margin-bottom: 0;
  z-index: 20;
}

.page-heading {
  flex: 1;
  min-width: 0;
}

.page-heading-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.4px;
  line-height: 1.2;
}

.page-heading-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.mobile-topbar {
  position: sticky;
  top: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--mobile-topbar-height);
  padding: 0 12px 0 8px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.mobile-menu-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  flex-shrink: 0;
  transition: background var(--transition);
}

.mobile-menu-btn:hover {
  background: var(--color-subtle);
}

.mobile-topbar-title {
  flex: 1;
  min-width: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-topbar-actions {
  flex-shrink: 0;
}

.mobile-page-subtitle {
  margin-bottom: 16px;
}

.mobile-page-subtitle p {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.45;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

.main-content--with-mobile-bar {
  padding-top: 12px;
}

@media (max-width: 768px) {
  .main-area {
    margin-left: 0;
    width: 100%;
    min-width: 0;
  }

  .main-content {
    padding: var(--content-padding-mobile);
    max-width: 100%;
  }

  .view-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .view-header--actions-only {
    position: static;
    margin-bottom: 16px;
    justify-content: flex-end;
  }

  .page-heading-title {
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 12px;
  }

  .mobile-topbar {
    padding: 0 8px 0 4px;
    gap: 8px;
  }

  .mobile-topbar-title {
    font-size: 16px;
  }
}
</style>
