<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { metaErrorApp } from '@/lib/erroresApp'
import { obtenerSesion } from '@/lib/session'
import { rutaInicioPorRol } from '@/lib/rutas'
import AtavLogoMark from '@/components/AtavLogoMark.vue'

const props = defineProps<{
  code?: string
}>()

const route = useRoute()
const router = useRouter()

const codigo = computed(() => (props.code || route.params.code || '404').toString())
const meta = computed(() => metaErrorApp(codigo.value))
const rutaOrigen = computed(() => (route.query.from as string) || '')

const inicioRuta = ref('/')

onMounted(async () => {
  const sesion = await obtenerSesion()
  inicioRuta.value = sesion ? rutaInicioPorRol(sesion.rol) : '/'
})

const irInicio = () => router.push(inicioRuta.value)
const volverAtras = () => {
  if (window.history.length > 1) router.back()
  else irInicio()
}
</script>

<template>
  <div class="error-page">
    <div class="error-waves" aria-hidden="true">
      <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path fill="rgba(15,23,42,0.04)" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L0,320Z"/>
      </svg>
    </div>

    <div class="error-card">
      <div class="error-brand">
        <AtavLogoMark :size="28" color="#fff" />
        <span class="error-brand-name">atav</span>
      </div>

      <div class="error-code-block" :class="`error-code-block--${meta.code}`">
        <span class="error-code">{{ meta.code }}</span>
      </div>

      <h1 class="error-title">{{ meta.titulo }}</h1>
      <p class="error-desc">{{ meta.descripcion }}</p>
      <p v-if="meta.hint" class="error-hint">{{ meta.hint }}</p>

      <p v-if="rutaOrigen" class="error-from">
        Ruta: <code>{{ rutaOrigen }}</code>
      </p>

      <div class="error-actions">
        <button type="button" class="error-btn error-btn-primary" @click="irInicio">
          Ir al inicio
        </button>
        <button type="button" class="error-btn error-btn-secondary" @click="volverAtras">
          Volver atrás
        </button>
      </div>

      <p class="error-footer">Derecho Virtual · USC</p>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: #fff;
  position: relative;
  overflow: hidden;
}

.error-waves {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  pointer-events: none;
}

.error-waves svg {
  width: 100%;
  height: 100%;
}

.error-card {
  width: min(440px, 100%);
  text-align: center;
  position: relative;
  z-index: 1;
  animation: error-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.error-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 32px;
}

.error-brand :deep(svg) {
  background: #0f172a;
  padding: 8px;
  border-radius: 12px;
}

.error-brand-name {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.error-code-block {
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
}

.error-code-block--401,
.error-code-block--403 {
  background: linear-gradient(145deg, #fffbeb, #fef3c7);
  border-color: #fde68a;
}

.error-code-block--500,
.error-code-block--503 {
  background: linear-gradient(145deg, #fef2f2, #fee2e2);
  border-color: #fecaca;
}

.error-code-block--offline {
  background: linear-gradient(145deg, #f1f5f9, #e2e8f0);
  border-color: #cbd5e1;
}

.error-code {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -2px;
  color: #0f172a;
  line-height: 1;
}

.error-title {
  font-size: clamp(20px, 4vw, 26px);
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 10px;
  line-height: 1.25;
}

.error-desc {
  font-size: 15px;
  color: #64748b;
  line-height: 1.55;
  margin-bottom: 8px;
}

.error-hint {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
  margin-bottom: 12px;
}

.error-from {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 24px;
}

.error-from code {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
}

.error-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.error-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.error-btn-primary {
  background: #0f172a;
  color: #fff;
}

.error-btn-primary:hover {
  background: #1e293b;
  transform: translateY(-1px);
}

.error-btn-secondary {
  background: #fff;
  color: #0f172a;
  border: 1px solid #e2e8f0;
}

.error-btn-secondary:hover {
  background: #f8fafc;
}

.error-footer {
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.04em;
}

@keyframes error-enter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .error-page {
    padding: 24px 16px;
  }

  .error-actions {
    flex-direction: column;
    width: 100%;
  }

  .error-btn-primary,
  .error-btn-secondary {
    width: 100%;
  }
}
</style>
