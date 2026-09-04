<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import Sidebar from "@/componentes/estructura/Sidebar.vue";
import Header from "@/componentes/estructura/Header.vue";
import AppDialog from "@/componentes/estructura/AppDialog.vue";
import ModalCambioPasswordObligatorio from "@/componentes/autenticacion/ModalCambioPasswordObligatorio.vue";
import { applyThemeForRole } from "@/lib/nucleo/theme";
import {
  validarSesionConServidor,
  sincronizarSesionLocal,
} from "@/lib/autenticacion/session";
import { consultarRequiereCambioPassword } from "@/lib/autenticacion/cambiarPasswordPropio";
import {
  headerInfoForPath,
  mobileBarTitleForPath,
} from "@/configuracion/titulosPagina";
import { useSidebar } from "@/composables/useSidebar";
import { useNetworkStatus } from "@/composables/useNetworkStatus";
import { useRouteStyles } from "@/composables/useRouteStyles";
import { useValidarSesionAlVolver } from "@/composables/useValidarSesionAlVolver";
import { iniciarControlVersionApp } from "@/lib/nucleo/appVersion";
import { conexionEnLinea } from "@/composables/useNetworkStatus";
import { sincronizarIndiceDirectorUid } from "@/lib/autenticacion/directorUidIndex";
import { esRolDirector } from "@/lib/nucleo/roles";

const route = useRoute();
const { isMobile, openMobileMenu } = useSidebar();
useNetworkStatus();
useRouteStyles(route);
useValidarSesionAlVolver();

const mostrarCambioPassword = ref(false);
const cedulaCambioPassword = ref("");
let detenerControlVersion: (() => void) | undefined;

async function revisarCambioPasswordPendiente() {
  const cedula = localStorage.getItem("cedula") || "";
  if (!cedula || route.path === "/" || route.path === "/registro") {
    mostrarCambioPassword.value = false;
    return;
  }
  cedulaCambioPassword.value = cedula;
  mostrarCambioPassword.value = await consultarRequiereCambioPassword(cedula);
}

onMounted(async () => {
  try {
    const validacion = await validarSesionConServidor();
    if (validacion.valida) {
      sincronizarSesionLocal(validacion.sesion);
      applyThemeForRole(validacion.sesion.rol);
      if (esRolDirector(validacion.sesion.rol) && validacion.sesion.uid) {
        void sincronizarIndiceDirectorUid(
          validacion.sesion.uid,
          validacion.sesion.rol,
          validacion.sesion.cedula,
        );
      }
      await revisarCambioPasswordPendiente();
    } else {
      applyThemeForRole(localStorage.getItem("rol"));
    }
  } catch {
    applyThemeForRole(localStorage.getItem("rol"));
  }

  detenerControlVersion = iniciarControlVersionApp();
});

onUnmounted(() => {
  detenerControlVersion?.();
});

watch(
  () => route.path,
  () => {
    void revisarCambioPasswordPendiente();
  },
);

const isLoginPage = computed(
  () => route.path === "/" || route.path === "/registro",
);
const isErrorPage = computed(
  () => route.name === "error" || route.path.startsWith("/error/"),
);

const headerInfo = computed(() => headerInfoForPath(route.path));

const mobileBarTitle = computed(() =>
  mobileBarTitleForPath(route.path, headerInfo.value.title),
);
</script>

<template>
  <div v-if="isLoginPage || isErrorPage" class="login-wrapper">
    <router-view />
  </div>
  <div v-else class="app-layout" :class="{ 'app-layout--mobile': isMobile }">
    <div v-if="!conexionEnLinea" class="offline-banner" role="status">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      Sin conexión. Tus datos del formulario se conservan hasta que vuelva
      internet.
    </div>
    <div class="app-layout-body">
      <Sidebar />
      <div class="main-area">
        <header v-if="isMobile" class="mobile-topbar">
          <button
            type="button"
            class="mobile-menu-btn"
            aria-label="Abrir menú"
            @click="openMobileMenu"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
          <span class="mobile-topbar-title">{{ mobileBarTitle }}</span>
          <div class="mobile-topbar-actions">
            <Header compact />
          </div>
        </header>
        <main
          class="main-content"
          :class="{ 'main-content--with-mobile-bar': isMobile }"
        >
          <div
            v-if="!isMobile"
            class="view-header"
            :class="{ 'view-header--actions-only': !headerInfo.title }"
          >
            <div v-if="headerInfo.title" class="page-heading">
              <h1 class="page-heading-title">{{ headerInfo.title }}</h1>
              <p v-if="headerInfo.subtitle" class="page-heading-subtitle">
                {{ headerInfo.subtitle }}
              </p>
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
          <footer class="support-footer">
            <p>
              ¿Presentas alguna falla? Comunícala al correo
              <span class="support-footer-email">soporte@atav.edu.co</span>
            </p>
          </footer>
        </main>
      </div>
    </div>
  </div>
  <AppDialog />
  <ModalCambioPasswordObligatorio
    v-if="mostrarCambioPassword && cedulaCambioPassword"
    :cedula="cedulaCambioPassword"
    @completado="mostrarCambioPassword = false"
  />
</template>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
}

.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: #fef3c7;
  color: #92400e;
  border-bottom: 1px solid #fcd34d;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  flex-shrink: 0;
  z-index: 50;
}

.app-layout-body {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
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

.support-footer {
  margin-top: 32px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border-light);
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.support-footer-email {
  color: var(--color-text-secondary);
  font-weight: 600;
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
