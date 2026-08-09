<script setup lang="ts">
withDefaults(
  defineProps<{
    showText?: boolean
    collapsed?: boolean
    size?: 'sm' | 'md' | 'lg'
    variant?: 'sidebar' | 'default'
  }>(),
  {
    showText: true,
    collapsed: false,
    size: 'md',
    variant: 'default',
  },
)
</script>

<template>
  <div
    class="atav-brand"
    :class="[
      `atav-brand--${size}`,
      `atav-brand--${variant}`,
      { 'atav-brand--collapsed': collapsed },
    ]"
  >
    <div class="atav-brand-mark" aria-hidden="true">
      <img src="/logoatav.svg" alt="" class="atav-brand-logo" />
    </div>
    <span v-if="showText" class="atav-brand-name">atav</span>
  </div>
</template>

<style scoped>
.atav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.atav-brand-mark {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.atav-brand-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.atav-brand-name {
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  font-style: normal;
  text-transform: lowercase;
  letter-spacing: 0.01em;
  line-height: 1;
  white-space: nowrap;
}

/* Tamaños */
.atav-brand--sm .atav-brand-mark {
  width: 26px;
  height: 26px;
}

.atav-brand--sm .atav-brand-name {
  font-size: 14px;
}

.atav-brand--md .atav-brand-mark {
  width: 34px;
  height: 28px;
}

.atav-brand--md .atav-brand-name {
  font-size: 17px;
}

.atav-brand--sidebar.atav-brand--md .atav-brand-name {
  font-size: 20px;
}

.atav-brand--lg .atav-brand-mark {
  width: 44px;
  height: 36px;
}

.atav-brand--lg .atav-brand-name {
  font-size: 20px;
}

.atav-brand--collapsed .atav-brand-mark {
  width: 30px;
  height: 26px;
}

/* Variantes */
.atav-brand--sidebar .atav-brand-name {
  color: var(--sidebar-logo, #f8fafc);
}

.atav-brand--default .atav-brand-mark {
  background: var(--color-primary, #0f172a);
  border-radius: 10px;
  padding: 4px;
}

.atav-brand--default .atav-brand-name {
  color: var(--color-text, #0f172a);
}
</style>
