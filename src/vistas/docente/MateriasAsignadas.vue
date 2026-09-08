<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import {
  fetchMaterias,
  filtrarMateriasPorProfesor,
  labelMateria,
  type MateriaRegistrada,
} from '@/lib/dominio/materias'

const materias = ref<MateriaRegistrada[]>([])
const cargando = ref(true)

const cargarMaterias = async () => {
  cargando.value = true
  try {
    const cedula = localStorage.getItem('cedula')
    let nombre = ''
    if (cedula) {
      const snap = await getDoc(doc(db, 'usuarios', cedula))
      if (snap.exists()) nombre = (snap.data().nombre || '').toString()
    }
    const todas = await fetchMaterias()
    materias.value = filtrarMateriasPorProfesor(todas, nombre)
  } catch (error) {
    console.error('Error cargando materias asignadas:', error)
    materias.value = []
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) cargarMaterias()
    else cargando.value = false
  })
})
</script>

<template>
  <div class="materias-page role-page">
    <p v-if="cargando" class="empty-state">Cargando materias...</p>

    <div v-else-if="materias.length" class="materias-grid">
      <article v-for="materia in materias" :key="materia.id" class="materia-card">
        <div class="materia-header">
          <span class="materia-codigo">{{ materia.codigo }}</span>
          <span v-if="materia.semestre" class="materia-semestre">{{ materia.semestre }}° semestre</span>
        </div>
        <h3 class="materia-nombre">{{ materia.nombre }}</h3>
        <p class="materia-label">{{ labelMateria(materia) }}</p>
        <div class="materia-meta">
          <span v-if="materia.dia">{{ materia.dia }}</span>
          <span v-if="materia.hora">{{ materia.hora }}</span>
        </div>
      </article>
    </div>

    <p v-else class="empty-state">
      No tienes materias asignadas. El director debe registrarte como profesor en cada materia.
    </p>
  </div>
</template>

<style scoped>
.materias-page {
  /* layout via .role-page */
}

.materias-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.materia-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.materia-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.materia-codigo {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--color-accent);
  background: var(--color-info-bg);
  padding: 2px 8px;
  border-radius: 4px;
}

.materia-semestre {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.materia-nombre {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.35;
}

.materia-label {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.materia-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.empty-state {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 32px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
