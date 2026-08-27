<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { mapRolMenu } from "@/lib/nucleo/roles";
import { obtenerSesion } from "@/lib/autenticacion/session";
import { useSidebar } from "@/composables/useSidebar";
import AtavBrand from "@/componentes/marca/AtavBrand.vue";

const route = useRoute();
const router = useRouter();
const { isMobile, mobileOpen, isOpen, toggleSidebar, closeMobileMenu } =
  useSidebar();

const inferRoleFromPath = (
  path: string,
): "docente" | "director" | "estudiante" => {
  if (path.startsWith("/docente")) return "docente";
  if (path.startsWith("/director")) return "director";
  if (path.startsWith("/estudiante")) return "estudiante";
  return "estudiante";
};

const roleFromStorage = (): "docente" | "director" | "estudiante" => {
  const rol = localStorage.getItem("rol");
  if (rol) return mapRolMenu(rol);
  return inferRoleFromPath(route.path);
};

// ── Estado del menú ──────────────────────────────────────────────
const role = ref<"docente" | "director" | "estudiante">(roleFromStorage());

// ── Cargar rol del usuario ───────────────────────────────────────
onMounted(async () => {
  const sesion = await obtenerSesion();
  if (!sesion) {
    router.push("/");
    return;
  }

  role.value = mapRolMenu(sesion.rol);
});

watch(
  () => route.path,
  (path) => {
    if (!localStorage.getItem("rol")) {
      role.value = inferRoleFromPath(path);
    }
  },
);

// ── Menú dinámico ────────────────────────────────────────────────
const menuItems = computed(() => {
  if (role.value === "docente") {
    return [
      { name: "Inicio", path: "/docente/dashboard", icon: "home" },
      {
        name: "Mis solicitudes",
        path: "/docente/mis-solicitudes",
        icon: "file",
      },
      {
        name: "Materias asignadas",
        path: "/docente/materias-asignadas",
        icon: "book",
      },
      { name: "Calendario", path: "/docente/calendario", icon: "calendar" },
      { name: "Recursos", path: "/docente/recursos", icon: "folder" },
    ];
  }

  if (role.value === "director") {
    return [
      { name: "Inicio", path: "/director", icon: "home" },
      { name: "Solicitudes", path: "/director/solicitudes", icon: "inbox" },
      { name: "Aspirantes", path: "/director/aspirantes", icon: "user-plus" },
      { name: "Usuarios", path: "/director/usuarios", icon: "users" },
      { name: "Materias", path: "/director/materias", icon: "book" },
      { name: "Llamadas", path: "/director/llamadas", icon: "phone" },
      {
        name: "Fechas parciales",
        path: "/director/parciales",
        icon: "calendar",
      },
      { name: "Calendario", path: "/director/calendario", icon: "calendar" },
      { name: "Reportes", path: "/director/reportes", icon: "chart" },
      { name: "Recursos", path: "/director/recursos", icon: "folder" },
    ];
  }

  return [
    { name: "Inicio", path: "/estudiante", icon: "home" },
    { name: "Mis materias", path: "/estudiante/materias", icon: "book" },
    {
      name: "Solicitar flexibilización",
      path: "/estudiante/flexibilidad",
      icon: "calendar-clock",
    },
    {
      name: "Solicitar supletorio",
      path: "/estudiante/supletorios",
      icon: "file-check",
    },
    {
      name: "Solicitar habilitación",
      path: "/estudiante/habilitaciones",
      icon: "book-open",
    },
    { name: "Calendario", path: "/estudiante/calendario", icon: "calendar" },
    { name: "Recursos", path: "/estudiante/recursos", icon: "folder" },
  ];
});

// ── Ruta activa ──────────────────────────────────────────────────
const isActive = (path: string) => {
  const current = route.path;
  if (current === path) return true;
  if (
    path === "/director" ||
    path === "/estudiante" ||
    path === "/docente/dashboard"
  ) {
    return false;
  }
  return current.startsWith(`${path}/`);
};

const onNavClick = () => {
  if (isMobile.value) closeMobileMenu();
};

watch(
  () => route.path,
  () => {
    if (isMobile.value) closeMobileMenu();
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isMobile && mobileOpen"
      class="sidebar-backdrop"
      aria-hidden="true"
      @click="closeMobileMenu"
    />
  </Teleport>

  <aside
    class="sidebar"
    :class="{
      closed: !isOpen && !isMobile,
      'sidebar--mobile': isMobile,
      'sidebar--mobile-open': isMobile && mobileOpen,
    }"
  >
    <div
      class="sidebar-header"
      :class="{ 'sidebar-header--collapsed': !isOpen && !isMobile }"
    >
      <AtavBrand
        variant="sidebar"
        size="md"
        :show-text="isOpen || isMobile"
        :collapsed="!isOpen && !isMobile"
        class="sidebar-brand"
      />
      <button
        v-if="isMobile && mobileOpen"
        type="button"
        class="sidebar-header-btn"
        aria-label="Cerrar menú"
        @click.stop="closeMobileMenu"
      >
        <svg
          class="mobile-close-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <button
        v-else-if="!isMobile"
        type="button"
        class="sidebar-header-btn sidebar-collapse-btn"
        :class="{ 'sidebar-collapse-btn--closed': !isOpen }"
        aria-label="Alternar menú"
        @click.stop="toggleSidebar"
      >
        <svg
          class="back-flag"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      <ul>
        <li v-for="item in menuItems" :key="item.path">
          <router-link
            :to="item.path"
            :class="['nav-link', { active: isActive(item.path) }]"
            @click="onNavClick"
          >
            <span class="nav-icon">
              <svg
                v-if="item.icon === 'home'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <svg
                v-else-if="item.icon === 'plus'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <svg
                v-else-if="item.icon === 'file'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <svg
                v-else-if="item.icon === 'bell'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <svg
                v-else-if="item.icon === 'inbox'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path
                  d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'users'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <svg
                v-else-if="item.icon === 'user-plus'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <svg
                v-else-if="item.icon === 'chart'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <svg
                v-else-if="item.icon === 'book'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path
                  d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'book-open'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <svg
                v-else-if="item.icon === 'calendar-clock'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <circle cx="12" cy="16" r="3" />
                <line x1="12" y1="14" x2="12" y2="16" />
              </svg>
              <svg
                v-else-if="item.icon === 'file-check'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                />
                <polyline points="14 2 14 8 20 8" />
                <polyline points="9 15 11 17 15 13" />
              </svg>
              <svg
                v-else-if="item.icon === 'folder'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'settings'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'phone'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'calendar'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <span class="nav-text">{{ item.name }}</span>
          </router-link>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 240px;
  height: 100vh;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  border-radius: 0 20px 20px 0;
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: all 0.3s ease;
}

.sidebar.closed {
  width: 72px;
}

.sidebar-header {
  padding: 18px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.sidebar-header--collapsed {
  flex-direction: column;
  justify-content: center;
  padding: 14px 8px;
  gap: 10px;
}

.sidebar-header-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sidebar-text);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background var(--transition),
    color var(--transition);
}

.sidebar-header-btn:hover {
  background: var(--sidebar-hover-bg);
  color: var(--sidebar-text-hover);
}

.sidebar-collapse-btn--closed .back-flag {
  transform: rotate(180deg);
}

.sidebar-brand {
  flex: 1;
  min-width: 0;
}

.sidebar-header--collapsed .sidebar-brand {
  flex: 0;
  justify-content: center;
}

.back-flag {
  flex-shrink: 0;
  color: inherit;
  opacity: 0.85;
  transition: transform 0.25s ease;
}

.mobile-close-icon {
  color: inherit;
}

.sidebar-nav {
  flex: 1;
  padding: 8px 12px;
  overflow-y: auto;
}

.sidebar.closed .sidebar-nav {
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar-nav ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar.closed .sidebar-nav ul {
  gap: 12px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--sidebar-text);
  transition: all var(--transition);
  font-weight: 500;
  font-size: 13px;
}

.sidebar.closed .nav-link {
  padding: 10px;
  justify-content: center;
  border-radius: 12px;
  width: 44px;
  margin: 0 auto;
}

.nav-link:hover {
  background: var(--sidebar-hover-bg);
  color: var(--sidebar-text-hover);
  border-radius: 12px;
}

.nav-link.active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  border-radius: 12px;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-text {
  display: block;
}

.sidebar.closed .nav-text {
  display: none;
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 199;
  animation: backdrop-in 0.25s ease;
}

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: min(280px, 88vw);
    transform: translateX(-100%);
    z-index: 200;
    border-radius: 0 20px 20px 0;
    box-shadow: none;
  }

  .sidebar.sidebar--mobile-open {
    transform: translateX(0);
    box-shadow: 8px 0 32px rgba(0, 0, 0, 0.2);
  }

  .sidebar.sidebar--mobile.closed {
    width: min(280px, 88vw);
  }

  .sidebar.sidebar--mobile .sidebar-header {
    padding: 16px 18px;
    justify-content: space-between;
  }

  .sidebar.sidebar--mobile .nav-link {
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 14px;
  }

  .sidebar.sidebar--mobile .sidebar-nav {
    padding: 12px 14px;
  }
}
</style>
