<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { obtenerSesion } from "@/lib/autenticacion/session";
import { fetchMaterias, type MateriaRegistrada } from "@/lib/dominio/materias";
import {
  cancelarSuscripcion,
  cargarSuscripcionesMateria,
  guardarCorreoPersonal,
  suscribirMateria,
  type SuscripcionMateria,
} from "@/lib/dominio/suscripcionesMaterias";

const materias = ref<MateriaRegistrada[]>([]);
const suscripciones = ref<SuscripcionMateria[]>([]);
const correoPersonal = ref("");
const correoConfirmacion = ref("");
const cargando = ref(true);
const guardando = ref<string | null>(null);
const error = ref("");
const mensaje = ref("");
const cedula = ref("");

const suscrita = (codigo: string) =>
  suscripciones.value.some((s) => s.materia_codigo === codigo);
const tieneCorreo = computed(() => correoPersonal.value.trim().length > 0);

const cargar = async () => {
  const user = auth.currentUser;
  if (!user) return;
  const sesion = await obtenerSesion();
  cedula.value = sesion?.cedula || localStorage.getItem("cedula") || "";
  const perfil = cedula.value
    ? await getDoc(doc(db, "usuarios", cedula.value))
    : null;
  correoPersonal.value = (perfil?.data()?.correo_personal || "")
    .toString()
    .trim();
  const [catalogo, activas] = await Promise.all([
    fetchMaterias(),
    cargarSuscripcionesMateria(user.uid),
  ]);
  materias.value = catalogo;
  suscripciones.value = activas;
};

const alternar = async (materia: MateriaRegistrada) => {
  error.value = "";
  mensaje.value = "";
  const user = auth.currentUser;
  if (!user) return;
  if (!suscrita(materia.codigo) && !tieneCorreo.value) {
    error.value =
      "Ingresa y confirma tu correo personal para recibir avisos de tus materias.";
    return;
  }
  if (
    !suscrita(materia.codigo) &&
    correoPersonal.value.trim().toLowerCase() !==
      correoConfirmacion.value.trim().toLowerCase()
  ) {
    error.value = "Los correos no coinciden.";
    return;
  }

  guardando.value = materia.codigo;
  try {
    if (suscrita(materia.codigo)) {
      await cancelarSuscripcion(user.uid, materia.codigo);
      suscripciones.value = suscripciones.value.filter(
        (s) => s.materia_codigo !== materia.codigo,
      );
      mensaje.value = "Suscripción cancelada.";
    } else {
      await guardarCorreoPersonal(cedula.value, correoPersonal.value);
      await suscribirMateria(user.uid, materia, correoPersonal.value);
      suscripciones.value.push({
        id: "",
        estudiante_id: user.uid,
        materia_codigo: materia.codigo,
        materia_label: `${materia.codigo} — ${materia.nombre}`,
        profesor: materia.profesor || "",
        semestre: materia.semestre || "",
        correo_personal: correoPersonal.value,
      });
      correoConfirmacion.value = "";
      mensaje.value =
        "Materia suscrita. Recibirás avisos en ATAV y en tu correo personal.";
    }
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "No se pudo actualizar la suscripción.";
  } finally {
    guardando.value = null;
  }
};

onMounted(async () => {
  try {
    await cargar();
  } catch {
    error.value = "No se pudieron cargar las materias.";
  } finally {
    cargando.value = false;
  }
});
</script>

<template>
  <div class="role-page materias-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Semestre actual</p>
        <h1>Mis materias</h1>
        <p>Elige las materias que estás viendo para recibir sus novedades.</p>
      </div>
    </header>
    <section class="materias-contacto">
      <strong>¿Cuál es tu correo electrónico personal?</strong>
      <p v-if="tieneCorreo">Usaremos este correo en todas tus suscripciones.</p>
      <template v-else>
        <p>
          Solo te lo pediremos una vez, al suscribirte a tu primera materia.
        </p>
        <div class="correo-grid">
          <input
            v-model="correoPersonal"
            type="email"
            placeholder="tu-correo-personal@ejemplo.com"
            aria-label="Correo personal"
          />
          <input
            v-model="correoConfirmacion"
            type="email"
            placeholder="Confirma tu correo personal"
            aria-label="Confirma tu correo personal"
          />
        </div>
      </template>
    </section>
    <p v-if="error" class="materias-alert materias-alert--error">{{ error }}</p>
    <p v-if="mensaje" class="materias-alert materias-alert--ok">
      {{ mensaje }}
    </p>
    <p v-if="cargando">Cargando materias...</p>
    <div v-else class="materias-list">
      <article
        v-for="materia in materias"
        :key="materia.id"
        class="materia-row"
      >
        <div>
          <strong>{{ materia.codigo }} — {{ materia.nombre }}</strong
          ><span
            >{{ materia.semestre || "Semestre no indicado" }} ·
            {{ materia.profesor || "Profesor no indicado" }}</span
          >
        </div>
        <button
          type="button"
          :disabled="guardando === materia.codigo"
          :class="{ activa: suscrita(materia.codigo) }"
          @click="alternar(materia)"
        >
          {{
            guardando === materia.codigo
              ? "Guardando..."
              : suscrita(materia.codigo)
                ? "Suscrita"
                : "Suscribirme"
          }}
        </button>
      </article>
      <p v-if="!materias.length">
        No hay materias registradas para seleccionar.
      </p>
    </div>
  </div>
</template>

<style scoped>
.materias-page {
  max-width: 900px;
}
.page-header {
  margin-bottom: 24px;
}
.eyebrow {
  margin: 0 0 4px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.page-header h1 {
  margin: 0;
}
.page-header p:last-child {
  color: #64748b;
}
.materias-contacto {
  padding: 18px;
  border: 1px solid #cbd5e1;
  border-left: 4px solid #0f766e;
  background: #f8fafc;
  margin-bottom: 18px;
}
.materias-contacto p {
  margin: 6px 0 12px;
  color: #64748b;
}
.correo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.materias-list {
  display: grid;
  gap: 10px;
}
.materia-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  background: #fff;
}
.materia-row div {
  display: grid;
  gap: 5px;
}
.materia-row span {
  color: #64748b;
  font-size: 13px;
}
button {
  border: 1px solid #0f766e;
  border-radius: 6px;
  padding: 9px 13px;
  color: #0f766e;
  background: white;
  cursor: pointer;
  white-space: nowrap;
}
button.activa {
  color: white;
  background: #0f766e;
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.materias-alert {
  padding: 12px;
  border-radius: 6px;
  margin: 10px 0;
}
.materias-alert--error {
  color: #991b1b;
  background: #fef2f2;
}
.materias-alert--ok {
  color: #166534;
  background: #f0fdf4;
}
@media (max-width: 640px) {
  .correo-grid {
    grid-template-columns: 1fr;
  }
  .materia-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
