<script setup lang="ts">
import type { DetailField } from '@/lib/tableDetail'

export type { DetailField }

const props = defineProps<{
  open: boolean
  title: string
  subtitle?: string
  fields: DetailField[]
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')">
        <div class="modal-card modal-detail" role="dialog" aria-modal="true">
          <div class="modal-top">
            <div class="modal-top-row">
              <div class="modal-top-text">
                <h2 class="modal-title">{{ title }}</h2>
                <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
              </div>
              <button type="button" class="modal-close" aria-label="Cerrar" @click="emit('close')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="modal-body modal-body--compact">
            <dl class="detail-fields">
              <div v-for="(field, i) in fields" :key="i" class="detail-field">
                <dt class="detail-label">{{ field.label }}</dt>
                <dd class="detail-value">
                  <a
                    v-if="field.href"
                    :href="field.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="detail-link"
                  >
                    {{ field.value }}
                  </a>
                  <span v-else>{{ field.value }}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="emit('close')">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-detail {
  max-width: 520px;
}

.detail-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
}

.detail-field {
  display: grid;
  grid-template-columns: minmax(100px, 34%) 1fr;
  gap: 8px 16px;
  align-items: start;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0;
}

.detail-value {
  font-size: 14px;
  color: var(--color-text);
  margin: 0;
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
}

.detail-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--color-border-light);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .detail-field {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
