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

const mostrarAviso = ref(false);
const mensajeAviso = ref("");

const cargarMaterias = async () => {
  const user = auth.currentUser;

  if (!user) return;

  try {
    materias.value = await cargarSuscripcionesMateria(user.uid);
  } catch (e) {
    console.error(e);
    error.value = "No se pudieron cargar tus encuentros.";
  } finally {
    cargando.value = false;
  }
};


const abrirReunion = (materia: SuscripcionMateria) => {

  if (materia.enlace_reunion) {

    window.open(
      materia.enlace_reunion,
      "_blank"
    );

  } else {

    mensajeAviso.value =
      "El docente todavía no ha configurado el enlace de la reunión virtual.";

    mostrarAviso.value = true;

  }

};


const cerrarAviso = () => {
  mostrarAviso.value = false;
};


onMounted(() => {
  cargarMaterias();
});
</script>


<template>

<div class="encuentros-page role-page">


  <div class="page-header">

    <h1>
      Mis encuentros
    </h1>

    <p>
      Accede a tus clases virtuales del semestre
    </p>

  </div>



  <p 
    v-if="cargando"
    class="empty-state"
  >
    Cargando encuentros...
  </p>



  <p 
    v-else-if="error"
    class="empty-state"
  >
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
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >

          <polygon points="23 7 16 12 23 17 23 7"/>

          <rect 
            x="1"
            y="5"
            width="15"
            height="14"
            rx="2"
          />

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

      <div class="meeting-icon">
  <svg 
    width="28" 
    height="28" 
    viewBox="0 0 24 24" 
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
</div>





      <button

        type="button"

        class="reunion-btn"

        :class="{
          disabled: !materia.enlace_reunion
        }"

        @click="abrirReunion(materia)"

      >

        {{
          materia.enlace_reunion
          ? "Ingresar a reunión"
          : "Sin enlace disponible"
        }}


      </button>



    </article>



  </div>




  <p
    v-else
    class="empty-state"
  >

    No tienes materias suscritas actualmente.

  </p>






  <!-- MODAL -->

  <div

    v-if="mostrarAviso"

    class="modal-overlay"

    @click.self="cerrarAviso"

  >



    <div class="modal-aviso">


      <div class="modal-icono">


        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >

          <polygon points="23 7 16 12 23 17 23 7"/>

          <rect 
            x="1"
            y="5"
            width="15"
            height="14"
            rx="2"
          />

        </svg>


      </div>



      <h3>
        Reunión no disponible
      </h3>



      <p>
        {{ mensajeAviso }}
      </p>




      <button

        class="modal-btn"

        @click="cerrarAviso"

      >

        Entendido

      </button>



    </div>


  </div>




</div>


</template>



<style scoped>


.encuentros-page {

  max-width: 950px;

  padding: 20px;

}



.page-header h1 {

  font-size: 28px;

  margin-bottom: 6px;

}



.page-header p {

  color: var(--color-text-muted);

  margin-bottom: 30px;

}




.encuentros-grid {

  display:grid;

  gap:18px;

}




.encuentro-card {


  background:white;

  border:1px solid var(--color-border-light);

  border-radius:18px;

  padding:22px;

  display:flex;

  align-items:center;

  gap:18px;

  box-shadow:0 8px 25px rgba(15,23,42,.05);

  transition:.2s;


}



.encuentro-card:hover {

  transform:translateY(-2px);

}




.encuentro-icon {


  width:52px;

  height:52px;

  border-radius:16px;

  background:#ecfdf5;

  color:#059669;

  display:flex;

  align-items:center;

  justify-content:center;


}




.encuentro-info {

  flex:1;

}



.materia-codigo {


  display:inline-block;

  font-size:12px;

  font-weight:700;

  color:#2563eb;

  background:#eff6ff;

  padding:5px 10px;

  border-radius:10px;


}




.encuentro-info h3 {


  margin:10px 0 6px;

  font-size:19px;

  color:#0f172a;


}




.encuentro-info p {


  margin:0;

  color:#64748b;

}



.encuentro-info small {


  color:#94a3b8;

}





.reunion-btn {


  border:none;

  border-radius:12px;

  padding:12px 22px;

  background:#087f6e;

  color:white;

  font-weight:600;

  cursor:pointer;

  transition:.2s;


}



.reunion-btn:hover {


  background:#115e59;


}



.reunion-btn.disabled {


  background:#cbd5e1;

  cursor:not-allowed;


}




.empty-state {


  text-align:center;

  padding:35px;

  color:var(--color-text-muted);

  background:white;

  border-radius:16px;

  border:1px solid var(--color-border-light);


}




.modal-overlay {


  position:fixed;

  inset:0;

  background:rgba(15,23,42,.45);

  display:flex;

  justify-content:center;

  align-items:center;

  z-index:999;


}





.modal-aviso {


  width:380px;

  background:white;

  padding:30px;

  border-radius:20px;

  text-align:center;

  box-shadow:0 20px 50px rgba(0,0,0,.2);


}




.modal-icono {


  width:60px;

  height:60px;

  margin:auto;

  border-radius:50%;

  background:#ecfdf5;

  color:#059669;

  display:flex;

  align-items:center;

  justify-content:center;


}





.modal-aviso h3 {


  margin-top:18px;

  color:#0f172a;


}





.modal-aviso p {


  color:#64748b;

  line-height:1.5;


}

.meeting-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #e8fff7;
  color: #00a878;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-btn {


  margin-top:20px;

  background:#087f6e;

  color:white;

  border:none;

  padding:12px 30px;

  border-radius:12px;

  cursor:pointer;
  font-weight:600;
}
@media(max-width:768px){
.encuentro-card{
  flex-direction:column;
  align-items:stretch;
}
.reunion-btn{
  width:100%;
}
}
</style>