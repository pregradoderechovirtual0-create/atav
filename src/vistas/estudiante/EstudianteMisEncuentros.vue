<script setup lang="ts">
import { ref, onMounted } from "vue";
import { auth } from "@/lib/firebase";
import {
  cargarSuscripcionesMateria,
  type SuscripcionMateria,
} from "@/lib/dominio/suscripcionesMaterias";

const materias = ref<SuscripcionMateria[]>([]);
const cargando = ref(true);
const error = ref("");

const cargarMaterias = async () => {
  const user = auth.currentUser;

  if (!user) return;

  try {
    materias.value = await cargarSuscripcionesMateria(user.uid);
  } catch (e) {
    console.error(e);
    error.value = "No se pudieron cargar tus materias.";
  } finally {
    cargando.value = false;
  }
};

const abrirReunion = (materia: SuscripcionMateria) => {
  if (materia.enlace_reunion) {
    window.open(materia.enlace_reunion, "_blank");
  } else {
    alert("El docente todavía no ha configurado el enlace de reunión.");
  }
};

onMounted(() => {
  cargarMaterias();
});
</script>

<template>
  <div class="materias-page role-page">

    <p v-if="cargando" class="empty-state">
      Cargando materias...
    </p>

    <p v-else-if="error" class="empty-state">
      {{ error }}
    </p>

    <div v-else-if="materias.length" class="materias-grid">

      <article 
        v-for="materia in materias"
        :key="materia.id || materia.materia_codigo"
        class="materia-card"
      >

        <div class="materia-header">
          <span class="materia-codigo">
            {{ materia.materia_codigo }}
          </span>

          <span class="materia-semestre">
            {{ materia.semestre || 'Semestre' }}
          </span>
        </div>


        <h3 class="materia-nombre">
          {{ materia.materia_label }}
        </h3>


        <p class="materia-label">
          Profesor: {{ materia.profesor || "No asignado" }}
        </p>


        <button
          type="button"
          class="reunion-btn"
          @click="abrirReunion(materia)"
        >
          Ingresar a reunión virtual
        </button>


      </article>

    </div>


    <p v-else class="empty-state">
      No tienes materias suscritas actualmente.
    </p>

  </div>
</template>