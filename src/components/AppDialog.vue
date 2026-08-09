<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue'
import {
  dialogState,
  acceptDialog,
  cancelDialog,
} from '@/lib/dialog'

const inputRef = ref<HTMLInputElement | null>(null)

const showCancel = computed(() => dialogState.kind !== 'alert')
const isDanger = computed(() => dialogState.variant === 'danger')
const isSolicitud = computed(() => dialogState.kind === 'confirm-solicitud')

watch(
  () => dialogState.open,
  async (open) => {
    if (open && dialogState.kind === 'prompt') {
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

const onKeydown = (event: KeyboardEvent) => {
  if (!dialogState.open) return
  if (event.key === 'Escape') cancelDialog()
  if (event.key === 'Enter' && dialogState.kind !== 'prompt') acceptDialog()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="app-dialog">
      <div
        v-if="dialogState.open"
        class="app-dialog-overlay"
        @click.self="cancelDialog"
        @keydown="onKeydown"
      >
        <div
          class="app-dialog-card"
          :class="{ 'app-dialog-card--solicitud': isSolicitud }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="dialogState.title ? 'app-dialog-title' : undefined"
        >
          <div class="app-dialog-header">
            <h2 id="app-dialog-title" class="app-dialog-title">{{ dialogState.title }}</h2>
            <p v-if="isSolicitud" class="app-dialog-subtitle">
              Revisa los datos antes de enviar tu solicitud de {{ dialogState.solicitudTipo }}.
            </p>
          </div>

          <div class="app-dialog-body">
            <template v-if="isSolicitud">
              <div class="app-dialog-solicitud">
                <section class="app-dialog-section">
                  <h3 class="app-dialog-section-title">Estudiante</h3>
                  <p class="app-dialog-declaracion">
                    Yo, <strong>{{ dialogState.solicitudNombre }}</strong>, identificado con número de cédula
                    <strong>{{ dialogState.solicitudCedula }}</strong>, declaro que deseo enviar la siguiente solicitud:
                  </p>
                </section>

                <section class="app-dialog-section">
                  <h3 class="app-dialog-section-title">Detalle de la solicitud</h3>
                  <dl class="app-dialog-detalles">
                    <div
                      v-for="(item, idx) in dialogState.solicitudDetalles"
                      :key="idx"
                      class="app-dialog-detalle-row"
                    >
                      <dt>{{ item.label }}</dt>
                      <dd>{{ item.value }}</dd>
                    </div>
                  </dl>
                </section>

                <p class="app-dialog-pregunta">¿Confirmas el envío de esta solicitud?</p>
              </div>
            </template>

            <template v-else>
              <p class="app-dialog-message">{{ dialogState.message }}</p>
              <input
                v-if="dialogState.kind === 'prompt'"
                ref="inputRef"
                v-model="dialogState.inputValue"
                type="text"
                class="app-dialog-input"
                :placeholder="dialogState.inputPlaceholder"
                @keydown.enter.prevent="acceptDialog"
              />
            </template>
          </div>

          <div class="app-dialog-footer" :class="{ 'app-dialog-footer--solicitud': isSolicitud }">
            <button
              v-if="showCancel"
              type="button"
              class="role-btn app-dialog-btn-cancel"
              @click="cancelDialog"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              {{ dialogState.cancelText }}
            </button>
            <button
              type="button"
              :class="[
                'role-btn',
                isSolicitud ? 'app-dialog-btn-confirm' : (isDanger ? 'role-btn-danger' : 'role-btn-primary'),
              ]"
              @click="acceptDialog"
            >
              <svg v-if="isSolicitud" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {{ dialogState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.app-dialog-card {
  width: 100%;
  max-width: 440px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: min(90vh, 720px);
}

.app-dialog-card--solicitud {
  max-width: 520px;
}

.app-dialog-header {
  padding: 22px 24px 0;
  flex-shrink: 0;
}

.app-dialog-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
}

.app-dialog-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.app-dialog-body {
  padding: 14px 24px 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}

.app-dialog-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}

.app-dialog-solicitud {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.app-dialog-section {
  padding: 14px 16px;
  background: var(--color-subtle);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
}

.app-dialog-section-title {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.app-dialog-declaracion {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-text-secondary);
}

.app-dialog-declaracion strong {
  color: var(--color-text);
  font-weight: 700;
}

.app-dialog-detalles {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.app-dialog-detalle-row {
  display: grid;
  grid-template-columns: minmax(100px, 38%) 1fr;
  gap: 8px 12px;
  align-items: start;
}

.app-dialog-detalle-row dt {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0;
}

.app-dialog-detalle-row dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.45;
}

.app-dialog-pregunta {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  text-align: center;
  padding: 4px 0;
}

.app-dialog-input {
  width: 100%;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
}

.app-dialog-input:focus {
  border-color: var(--color-primary);
}

.app-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 24px 24px;
  flex-shrink: 0;
}

.app-dialog-footer--solicitud {
  justify-content: stretch;
}

.app-dialog-footer--solicitud .role-btn {
  flex: 1;
}

.app-dialog-btn-cancel {
  background: #dc2626;
  color: white;
  border: 1px solid #b91c1c;
}

.app-dialog-btn-cancel:hover:not(:disabled) {
  background: #b91c1c;
}

.app-dialog-btn-confirm {
  background: #16a34a;
  color: white;
  border: 1px solid #15803d;
}

.app-dialog-btn-confirm:hover:not(:disabled) {
  background: #15803d;
}

.app-dialog-enter-active,
.app-dialog-leave-active {
  transition: opacity 0.2s ease;
}

.app-dialog-enter-active .app-dialog-card,
.app-dialog-leave-active .app-dialog-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.app-dialog-enter-from,
.app-dialog-leave-to {
  opacity: 0;
}

.app-dialog-enter-from .app-dialog-card,
.app-dialog-leave-to .app-dialog-card {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

@media (max-width: 520px) {
  .app-dialog-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .app-dialog-card,
  .app-dialog-card--solicitud {
    max-width: 100%;
    width: 100%;
    max-height: 92dvh;
    border-radius: 16px 16px 0 0;
  }

  .app-dialog-header {
    padding: 18px 16px 0;
  }

  .app-dialog-body {
    padding: 12px 16px 16px;
  }

  .app-dialog-footer {
    flex-direction: column-reverse;
    padding: 12px 16px max(20px, env(safe-area-inset-bottom));
    gap: 8px;
  }

  .app-dialog-footer--solicitud .role-btn {
    min-height: 46px;
  }

  .app-dialog-detalle-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
