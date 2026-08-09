<script setup lang="ts">
import type { MateriaRegistrada } from '@/lib/materias'

defineProps<{
  materia: MateriaRegistrada
}>()
</script>

<template>
  <div class="sol-materia-info">
    <p class="sol-materia-info-title">Información de la materia</p>
    <div class="sol-materia-info-grid">
      <div class="sol-materia-info-item">
        <span class="sol-materia-info-label">Código</span>
        <span class="sol-materia-info-value">{{ materia.codigo }}</span>
      </div>
      <div class="sol-materia-info-item">
        <span class="sol-materia-info-label">Nombre</span>
        <span class="sol-materia-info-value">{{ materia.nombre }}</span>
      </div>
      <div class="sol-materia-info-item">
        <span class="sol-materia-info-label">Docente</span>
        <span class="sol-materia-info-value">{{ materia.profesor || '—' }}</span>
      </div>
      <div class="sol-materia-info-item">
        <span class="sol-materia-info-label">Semestre</span>
        <span class="sol-materia-info-value">{{ materia.semestre || '—' }}</span>
      </div>
      <div v-if="materia.dia" class="sol-materia-info-item">
        <span class="sol-materia-info-label">Día</span>
        <span class="sol-materia-info-value">{{ materia.dia }}</span>
      </div>
      <div v-if="materia.hora" class="sol-materia-info-item">
        <span class="sol-materia-info-label">Hora</span>
        <span class="sol-materia-info-value">{{ materia.hora }}</span>
      </div>
    </div>
  </div>
</template>
