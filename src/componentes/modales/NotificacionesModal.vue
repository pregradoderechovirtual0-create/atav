<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificaciones } from '@/composables/useNotificaciones'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const activeFilter = ref('todas')
const { notificaciones, loading, marcarLeida, marcarTodasLeidas } = useNotificaciones()

const notificacionesFiltradas = computed(() => {
  if (activeFilter.value === 'no-leidas') {
    return notificaciones.value.filter(n => !n.leida)
  }
  return notificaciones.value
})

const filters = computed(() => [
  { id: 'todas', label: 'Todas', count: notificaciones.value.length },
  { id: 'no-leidas', label: 'No leídas', count: notificaciones.value.filter(n => !n.leida).length },
])

const cerrar = () => emit('close')

const irA = async (notif: { id: string; ruta: string | null }) => {
  await marcarLeida(notif.id)
  if (notif.ruta) {
    cerrar()
    router.push(notif.ruta)
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) activeFilter.value = 'todas'
  }
)

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') cerrar()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="notif-modal">
      <div
        v-if="open"
        class="notif-modal-overlay"
        @click.self="cerrar"
        @keydown="onKeydown"
      >
        <div class="notif-modal" role="dialog" aria-modal="true" aria-labelledby="notif-modal-title">
          <div class="notif-modal-header">
            <div class="notif-modal-heading">
              <div class="notif-modal-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div>
                <h2 id="notif-modal-title" class="notif-modal-title">Notificaciones</h2>
                <p class="notif-modal-subtitle">Todas tus alertas y actualizaciones</p>
              </div>
            </div>
            <button type="button" class="notif-modal-close" aria-label="Cerrar" @click="cerrar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="notif-modal-toolbar">
            <div class="filter-tabs">
              <button
                v-for="filter in filters"
                :key="filter.id"
                :class="['filter-tab', { active: activeFilter === filter.id }]"
                @click="activeFilter = filter.id"
              >
                {{ filter.label }}
                <span class="filter-count">{{ filter.count }}</span>
              </button>
            </div>
            <button
              class="btn-mark-all"
              :disabled="!notificaciones.some(n => !n.leida)"
              @click="marcarTodasLeidas"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Marcar todo leído
            </button>
          </div>

          <div class="notif-modal-body">
            <p v-if="loading" class="empty-state">Cargando notificaciones...</p>

            <div v-else-if="notificacionesFiltradas.length" class="notifications-list">
              <button
                v-for="notif in notificacionesFiltradas"
                :key="notif.id"
                type="button"
                :class="['notification-item', { unread: !notif.leida }]"
                @click="irA(notif)"
              >
                <div :class="['notification-icon', notif.tipo]">
                  <svg v-if="notif.tipo === 'success'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <svg v-else-if="notif.tipo === 'info'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <svg v-else-if="notif.tipo === 'warning'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>

                <div class="notification-content">
                  <div class="notification-header">
                    <h3 class="notification-title">{{ notif.titulo }}</h3>
                    <span v-if="!notif.leida" class="unread-dot"/>
                  </div>
                  <p class="notification-mensaje">{{ notif.mensaje }}</p>
                  <span class="notification-fecha">{{ notif.fecha }}</span>
                </div>

                <button
                  v-if="!notif.leida"
                  type="button"
                  class="action-btn"
                  aria-label="Marcar como leído"
                  title="Marcar como leído"
                  @click.stop="marcarLeida(notif.id)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              </button>
            </div>

            <div v-else class="empty-state empty-illustrated">
              <div class="empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <p class="empty-title">
                {{ activeFilter === 'no-leidas' ? 'Sin notificaciones pendientes' : 'Todo tranquilo por aquí' }}
              </p>
              <p class="empty-desc">
                {{ activeFilter === 'no-leidas' ? 'Ya leíste todas tus notificaciones.' : 'Cuando haya novedades, aparecerán aquí.' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.notif-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.notif-modal {
  width: 100%;
  max-width: 560px;
  max-height: min(85vh, 720px);
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notif-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.notif-modal-heading {
  display: flex;
  align-items: center;
  gap: 14px;
}

.notif-modal-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: var(--color-info-bg);
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notif-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.3px;
}

.notif-modal-subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.notif-modal-close {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: all var(--transition);
  flex-shrink: 0;
}

.notif-modal-close:hover {
  background: var(--color-subtle);
  color: var(--color-text);
}

.notif-modal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  background: var(--color-subtle);
  border-bottom: 1px solid var(--color-border-light);
}

.filter-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  transition: all var(--transition);
}

.filter-tab:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

.filter-tab.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.filter-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
}

.filter-tab:not(.active) .filter-count {
  background: var(--color-subtle);
  color: var(--color-text-muted);
}

.btn-mark-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: all var(--transition);
  white-space: nowrap;
}

.btn-mark-all:hover:not(:disabled) {
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.btn-mark-all:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.notif-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition);
  cursor: pointer;
  text-align: left;
}

.notification-item:hover {
  border-color: var(--color-text-muted);
  box-shadow: var(--shadow-xs);
}

.notification-item.unread {
  background: var(--color-info-bg);
  border-color: rgba(59, 130, 246, 0.25);
}

.notification-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-icon.success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.notification-icon.info {
  background: rgba(59, 130, 246, 0.15);
  color: var(--color-info);
}

.notification-icon.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.notification-icon.error {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

.unread-dot {
  width: 6px;
  height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
  flex-shrink: 0;
}

.notification-mensaje {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: 6px;
  white-space: pre-line;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

.notification-fecha {
  font-size: 11px;
  color: var(--color-text-muted);
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: all var(--transition);
  flex-shrink: 0;
}

.action-btn:hover {
  background: var(--color-subtle);
  color: var(--color-text);
}

.empty-state {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 32px 16px;
}

.empty-illustrated {
  padding: 48px 24px;
}

.empty-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: var(--color-subtle);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 13px;
  color: var(--color-text-muted);
}

.notif-modal-enter-active,
.notif-modal-leave-active {
  transition: opacity 0.2s ease;
}

.notif-modal-enter-active .notif-modal,
.notif-modal-leave-active .notif-modal {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
}

.notif-modal-enter-from,
.notif-modal-leave-to {
  opacity: 0;
}

.notif-modal-enter-from .notif-modal,
.notif-modal-leave-to .notif-modal {
  transform: translateY(12px) scale(0.98);
  opacity: 0;
}

@media (max-width: 640px) {
  .notif-modal-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .notif-modal {
    max-height: 92vh;
    width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  .notif-modal-header {
    padding: 18px 16px 14px;
  }

  .notif-modal-toolbar {
    flex-direction: column;
    align-items: stretch;
    padding: 12px 16px;
    gap: 10px;
  }

  .notif-modal-body {
    padding: 12px 16px 20px;
  }

  .btn-mark-all {
    justify-content: center;
    white-space: normal;
    text-align: center;
  }

  .notification-item {
    padding: 12px 14px;
    gap: 10px;
  }
}
</style>
