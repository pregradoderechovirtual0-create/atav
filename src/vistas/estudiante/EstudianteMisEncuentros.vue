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
  <div class="encuentros-page role-page">

    <div class="page-header">
      <h1>Mis encuentros</h1>
      <p>
        Accede a tus clases virtuales del semestre
      </p>
    </div>


    <p v-if="cargando" class="empty-state">
      Cargando encuentros...
    </p>


    <p v-else-if="error" class="empty-state">
      {{ error }}
    </p>


    <div 
      v-else-if="materias.length"
      class="encuentros-grid"
    >

      <article
        v-for="materia in materias"
        :key="materia.id || materia.materia_codigo"
        class="encuentro-card"
      >

        <div class="encuentro-icon">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>


        <div class="encuentro-info">

          <span class="materia-codigo">
            {{ materia.materia_codigo }}
          </span>


          <h3>
            {{ materia.materia_label }}
          </h3>


          <p>
            Profesor:
            {{ materia.profesor || "No asignado" }}
          </p>


          <small>
            {{ materia.semestre || "Semestre actual" }}
          </small>

        </div>


        <button
          type="button"
          class="reunion-btn"
          @click="abrirReunion(materia)"
        >
          Ingresar a reunión
        </button>


      </article>

    </div>


    <p v-else class="empty-state">
      No tienes materias suscritas actualmente.
    </p>


  </div>
</template>

<style scoped>

.encuentros-page {
  padding: 20px;
}


.page-header h1 {
  font-size: 28px;
  margin-bottom: 6px;
}


.page-header p {
  color: var(--color-text-muted);
  margin-bottom: 25px;
}


.encuentros-grid {
  display: grid;
  gap: 18px;
}


.encuentro-card {
  background: white;
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 22px;
  display: flex;
  align-items: center;
  gap: 18px;
  justify-content: space-between;
}


.encuentro-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #ecfdf5;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
}


.encuentro-info {
  flex: 1;
}


.encuentro-info h3 {
  margin: 6px 0;
  font-size: 18px;
}


.encuentro-info p {
  margin: 0;
  color: #64748b;
}


.encuentro-info small {
  color: #94a3b8;
}


.reunion-btn {
  background: #087f6e;
  color: white;
  border: none;
  padding: 12px 22px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
}


.reunion-btn:hover {
  opacity: 0.9;
}


@media(max-width:768px){

  .encuentro-card {
    flex-direction: column;
    align-items: stretch;
  }

  .reunion-btn {
    width:100%;
  }

}

.materias-page {
  max-width: 900px;
}

.materias-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}


.materia-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}


.materia-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}


.materia-codigo {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent);
  background: var(--color-info-bg);
  padding: 4px 10px;
  border-radius: 8px;
}


.materia-semestre {
  font-size: 12px;
  color: var(--color-text-muted);
}


.materia-nombre {
  margin: 5px 0;
  font-size: 17px;
  color: var(--color-text);
}


.materia-label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}


.reunion-btn {

  margin-top: 10px;

  border: none;
  border-radius: 10px;

  padding: 11px 16px;

  background: #0f766e;
  color: white;

  font-weight: 600;
  font-size: 13px;

  cursor: pointer;

  transition: .2s;
}


.reunion-btn:hover {
  background: #115e59;
}


.empty-state {

  text-align: center;

  padding: 35px;

  color: var(--color-text-muted);

  background: var(--color-surface);

  border-radius: var(--radius-lg);

  border: 1px solid var(--color-border);

}

</style>