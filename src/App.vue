<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '@/componentes/estructura/Sidebar.vue'
import Header from '@/componentes/estructura/Header.vue'
import AppDialog from '@/componentes/estructura/AppDialog.vue'
import { applyThemeForRole } from '@/lib/nucleo/theme'
import { validarSesionConServidor, sincronizarSesionLocal } from '@/lib/autenticacion/session'
import { headerInfoForPath, mobileBarTitleForPath } from '@/configuracion/titulosPagina'
import { useSidebar } from '@/composables/useSidebar'
import { useNetworkStatus } from '@/composables/useNetworkStatus'
import { useRouteStyles } from '@/composables/useRouteStyles'
import { useValidarSesionAlVolver } from '@/composables/useValidarSesionAlVolver'

const route = useRoute()
const { isMobile, openMobileMenu } = useSidebar()
useNetworkStatus()
useRouteStyles(route)
useValidarSesionAlVolver()

onMounted(async () => {
  try {
    const validacion = await validarSesionConServidor()
    if (validacion.valida) {
      sincronizarSesionLocal(validacion.sesion)
      applyThemeForRole(validacion.sesion.rol)
      return
    }
    applyThemeForRole(localStorage.getItem('rol'))
  } catch {
    applyThemeForRole(localStorage.getItem('rol'))
  }
})

const isLoginPage = computed(() => route.path === '/' || route.path === '/registro')
const isErrorPage = computed(() => route.name === 'error' || route.path.startsWith('/error/'))

const headerInfo = computed(() => headerInfoForPath(route.path))

const mobileBarTitle = computed(() =>
  mobileBarTitleForPath(route.path, headerInfo.value.title),
)
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
