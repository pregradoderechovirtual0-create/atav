<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificaciones } from '@/composables/useNotificaciones'
import NotificacionesModal from '@/components/NotificacionesModal.vue'
import { obtenerSesion, cerrarSesion } from '@/lib/session'
import { labelRol, ROL_JEFA_SUPREMA } from '@/lib/roles'
import { isJefaPinkThemePreferred, setJefaPinkTheme } from '@/lib/theme'

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const router = useRouter()
const mostrarPanel = ref(false)
const mostrarPerfil = ref(false)
const mostrarModalNotificaciones = ref(false)
const { recientes, noLeidas, marcarLeida } = useNotificaciones()

const userName = ref('')
const userInitials = ref('')
const roleLabel = ref('')
const userRol = ref('')
const pinkTheme = ref(true)

const esJefaSuprema = computed(() => userRol.value === ROL_JEFA_SUPREMA)

const selectNormalTheme = () => {
  if (!pinkTheme.value) return
  pinkTheme.value = false
  setJefaPinkTheme(false, userRol.value)
}

const selectPinkTheme = () => {
  if (pinkTheme.value) return
  pinkTheme.value = true
  setJefaPinkTheme(true, userRol.value)
}

const irANotificacion = async (notif: { id: string; ruta: string | null }) => {
  await marcarLeida(notif.id)
  mostrarPanel.value = false
  if (notif.ruta) {
    router.push(notif.ruta)
  }
}

const abrirModalTodas = () => {
  mostrarPanel.value = false
  mostrarModalNotificaciones.value = true
}

const cerrarPaneles = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.notif-wrapper')) {
    mostrarPanel.value = false
  }
  if (!target.closest('.profile-wrapper')) {
    mostrarPerfil.value = false
  }
}

const irAPerfil = () => {
  mostrarPerfil.value = false
  router.push('/perfil')
}

const logout = async () => {
  mostrarPerfil.value = false
  try {
    await cerrarSesion()
    router.push('/')
  } catch (e) {
    console.error('Error cerrando sesión', e)
  }
}

onMounted(async () => {
  document.addEventListener('click', cerrarPaneles)

  const sesion = await obtenerSesion()
  if (!sesion) return

  userRol.value = sesion.rol
  pinkTheme.value = isJefaPinkThemePreferred()
  roleLabel.value = labelRol(sesion.rol)
  userName.value = sesion.nombre || 'Usuario'
  const partes = userName.value.split(' ').filter(Boolean)
  userInitials.value =
    partes.length >= 2
      ? partes[0][0] + partes[1][0]
      : partes[0]?.[0] || '?'
})
onUnmounted(() => document.removeEventListener('click', cerrarPaneles))
</script>

<template>
  <div class="top-actions" :class="{ 'top-actions--compact': compact }">
    <div class="actions-group" :class="{ 'actions-group--compact': compact }">
      <div class="notif-wrapper">
        <button
          type="button"
          class="header-btn"
          aria-label="Notificaciones"
          :aria-expanded="mostrarPanel"
          @click.stop="mostrarPanel = !mostrarPanel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span v-if="noLeidas > 0" class="notification-badge">{{ noLeidas > 9 ? '9+' : noLeidas }}</span>
        </button>

        <div v-if="mostrarPanel" class="notif-panel" @click.stop>
          <div class="notif-panel-header">
            <p class="notif-title">Notificaciones</p>
            <button class="notif-ver-todas" @click="abrirModalTodas">Ver todas</button>
          </div>

          <div v-if="recientes.length" class="notif-list">
            <button
              v-for="n in recientes"
              :key="n.id"
              :class="['notif-item', { unread: !n.leida }]"
              @click="irANotificacion(n)"
            >
              <span class="notif-item-title">{{ n.titulo }}</span>
              <span class="notif-mensaje">{{ n.mensaje }}</span>
              <span class="notif-time">{{ n.fecha }}</span>
            </button>
          </div>

          <p v-else class="notif-empty">No tienes notificaciones</p>
        </div>
      </div>

      <div
        v-if="esJefaSuprema"
        class="theme-toggle"
        role="group"
        aria-label="Tema de color"
      >
        <button
          type="button"
          class="theme-toggle-btn"
          :class="{ active: !pinkTheme }"
          aria-label="Colores normales"
          :aria-pressed="!pinkTheme"
          @click="selectNormalTheme"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="12" rx="2" ry="2"/>
            <line x1="2" y1="20" x2="22" y2="20"/>
          </svg>
        </button>
        <button
          type="button"
          class="theme-toggle-btn"
          :class="{ active: pinkTheme }"
          aria-label="Colores rosa"
          :aria-pressed="pinkTheme"
          @click="selectPinkTheme"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M12 19a3 3 0 1 1 3-3m-3 3a3 3 0 1 0-3-3m3 3v-1M5 12a3 3 0 1 1 3-3m-3 3a3 3 0 1 0 3 3m-3-3h1M19 12a3 3 0 1 1-3-3m3 3a3 3 0 1 0-3 3m3-3h-1"/>
          </svg>
        </button>
      </div>

      <div class="profile-wrapper">
        <button
          type="button"
          class="profile-btn"
          aria-label="Menú de perfil"
          :aria-expanded="mostrarPerfil"
          @click.stop="mostrarPerfil = !mostrarPerfil"
        >
          <div class="profile-avatar">{{ userInitials }}</div>
          <div class="profile-info">
            <span class="profile-name">{{ userName }}</span>
            <span class="profile-role">{{ roleLabel }}</span>
          </div>
          <svg class="profile-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div v-if="mostrarPerfil" class="profile-panel" @click.stop>
          <div class="profile-panel-header">
            <div class="profile-avatar profile-avatar-lg">{{ userInitials }}</div>
            <div>
              <p class="profile-panel-name">{{ userName }}</p>
              <p class="profile-panel-role">{{ roleLabel }}</p>
            </div>
          </div>
          <div class="profile-panel-actions">
            <button class="profile-action" @click="irAPerfil">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Mi perfil
            </button>
            <button class="profile-action logout" @click="logout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NotificacionesModal
    :open="mostrarModalNotificaciones"
    @close="mostrarModalNotificaciones = false"
  />
</template>

<style scoped>
.top-actions {
  flex-shrink: 0;
  z-index: 40;
}

.actions-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

.notif-wrapper {
  position: relative;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-lg);
  background: var(--color-subtle);
  border: 1px solid var(--color-border-light);
}

.theme-toggle-btn {
  width: 32px;
  height: 32px;
  border-radius: calc(var(--radius-lg) - 2px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: all var(--transition);
}

.theme-toggle-btn:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.6);
}

.theme-toggle-btn.active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-xs);
}

.header-btn {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  position: relative;
  transition: all var(--transition);
}

.header-btn:hover {
  background: var(--color-subtle);
  color: var(--color-text);
}

.notification-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--color-error);
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notif-panel {
  position: absolute;
  top: 44px;
  right: 0;
  width: 320px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 100;
  overflow: hidden;
}

.notif-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.notif-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.notif-ver-todas {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-accent);
}

.notif-ver-todas:hover {
  text-decoration: underline;
}

.notif-list {
  max-height: 360px;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-light);
  text-align: left;
  transition: background var(--transition);
}

.notif-item:last-child {
  border-bottom: none;
}

.notif-item:hover {
  background: var(--color-subtle);
}

.notif-item.unread {
  background: var(--color-info-bg);
}

.notif-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.notif-mensaje {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-time {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.notif-empty {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 24px 16px;
}

.profile-wrapper {
  position: relative;
}

.profile-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 4px 4px;
  border-radius: var(--radius-lg);
  transition: all var(--transition);
  border-left: 1px solid var(--color-border-light);
  margin-left: 2px;
}

.profile-btn:hover {
  background: var(--color-subtle);
}

.profile-avatar {
  width: 32px;
  height: 32px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 11px;
  flex-shrink: 0;
}

.profile-avatar-lg {
  width: 40px;
  height: 40px;
  font-size: 13px;
}

.profile-info {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.profile-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.2;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-role {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.2;
}

.profile-chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.profile-panel {
  position: absolute;
  top: 44px;
  right: 0;
  width: 240px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 100;
  overflow: hidden;
}

.profile-panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.profile-panel-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.profile-panel-role {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.profile-panel-actions {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: all var(--transition);
  text-align: left;
}

.profile-action:hover {
  background: var(--color-subtle);
  color: var(--color-text);
}

.profile-action.logout:hover {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.top-actions--compact .actions-group {
  padding: 2px;
  gap: 4px;
  border-radius: var(--radius-lg);
  box-shadow: none;
  border: none;
  background: transparent;
}

.actions-group--compact .header-btn {
  width: 36px;
  height: 36px;
}

.actions-group--compact .theme-toggle-btn {
  width: 30px;
  height: 30px;
}

.actions-group--compact .profile-btn {
  padding: 2px;
}

@media (max-width: 768px) {
  .actions-group {
    padding: 3px;
  }

  .profile-info,
  .profile-chevron {
    display: none;
  }

  .profile-btn {
    padding: 4px;
    border-left: none;
    margin-left: 0;
  }

  .notif-panel {
    position: fixed;
    top: calc(var(--mobile-topbar-height) + 6px);
    right: 12px;
    left: 12px;
    width: auto;
    max-width: none;
  }

  .profile-panel {
    position: fixed;
    top: calc(var(--mobile-topbar-height) + 6px);
    right: 12px;
    width: min(280px, calc(100vw - 24px));
    max-width: calc(100vw - 24px);
  }
}

@media (max-width: 480px) {
  .notif-panel {
    right: 8px;
    left: 8px;
  }

  .profile-panel {
    right: 8px;
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
  }
}
</style>
