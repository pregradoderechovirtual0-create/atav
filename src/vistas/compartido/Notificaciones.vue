<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificaciones } from '@/composables/useNotificaciones'

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

const irA = async (notif: { id: string; ruta: string | null }) => {
  await marcarLeida(notif.id)
  if (notif.ruta) router.push(notif.ruta)
}
</script>

<template>
  <div class="notificaciones">
    <div class="toolbar">
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
        class="btn btn-secondary"
        :disabled="!notificaciones.some(n => !n.leida)"
        @click="marcarTodasLeidas"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Marcar todo como leído
      </button>
    </div>

    <p v-if="loading" class="empty-state">Cargando notificaciones...</p>

    <div v-else-if="notificacionesFiltradas.length" class="notifications-list">
      <div
        v-for="notif in notificacionesFiltradas"
        :key="notif.id"
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

        <div class="notification-actions">
          <button
            v-if="!notif.leida"
            class="action-btn"
            aria-label="Marcar como leído"
            title="Marcar como leído"
            @click.stop="marcarLeida(notif.id)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <p v-else class="empty-state">
      {{ activeFilter === 'no-leidas' ? 'No tienes notificaciones sin leer.' : 'No tienes notificaciones todavía.' }}
    </p>
  </div>
</template>

<style scoped>
.notificaciones {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 800px;
  min-width: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
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
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(255,255,255,0.2);
}

.filter-tab:not(.active) .filter-count {
  background: var(--color-background);
  color: var(--color-text-muted);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-background);
  border-color: var(--color-text-muted);
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
  padding: 16px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition);
  cursor: pointer;
}

.notification-item:hover {
  border-color: var(--color-text-muted);
}

.notification-item.unread {
  background: var(--color-info-bg);
  border-color: rgba(59, 130, 246, 0.2);
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
  font-weight: 500;
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

.notification-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition);
}

.notification-item:hover .notification-actions {
  opacity: 1;
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
}

.action-btn:hover {
  background: var(--color-background);
  color: var(--color-text);
}

.empty-state {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 40px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .btn-secondary {
    width: 100%;
    justify-content: center;
    white-space: normal;
    text-align: center;
  }

  .notification-item {
    padding: 14px 16px;
    gap: 12px;
  }

  .notification-actions {
    opacity: 1;
  }
}
</style>
