<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  open: boolean
  variant: 'usuarios' | 'materias'
}>()

const emit = defineEmits<{
  close: []
  continue: []
}>()

const usuariosColumnas = [
  { col: 'cedula', desc: 'Número de cédula, solo dígitos (sin puntos ni espacios)' },
  { col: 'nombre', desc: 'Nombre completo del usuario' },
  { col: 'correo', desc: 'Correo válido (ej. usuario@ejemplo.com)' },
  { col: 'rol', desc: 'Docente, Estudiante o Director (rol Practicante en el sistema)' },
]

const materiasColumnas = [
  { col: 'codigo', desc: 'Código único de la materia (se usa como identificador)' },
  { col: 'nombre', desc: 'Nombre de la asignatura' },
  { col: 'semestre', desc: 'Número del semestre (1 a 10)' },
  { col: 'dia', desc: 'Lunes, Martes, Miércoles, Jueves, Viernes o Sábado' },
  { col: 'hora', desc: 'Formato HH:MM (ej. 08:00, 14:30)' },
  { col: 'profesor', desc: 'Nombre del docente asignado' },
]

const columnas = computed(() =>
  props.variant === 'usuarios' ? usuariosColumnas : materiasColumnas,
)

const titulo = computed(() =>
  props.variant === 'usuarios' ? 'Importar usuarios desde Excel' : 'Importar materias desde Excel',
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')">
        <div class="modal-card modal-form excel-guide-modal" role="dialog" aria-modal="true">
          <div class="modal-top">
            <div class="modal-top-row">
              <div class="modal-icon modal-icon--warning">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div class="modal-top-text">
                <h2 class="modal-title">{{ titulo }}</h2>
                <p class="modal-subtitle">
                  La primera fila del archivo debe ser el encabezado con estos nombres de columna exactos.
                  Formatos aceptados: .xlsx, .xls o .csv.
                </p>
              </div>
            </div>
          </div>

          <div class="excel-guide-body">
            <table class="excel-guide-table">
              <thead>
                <tr>
                  <th>Columna</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in columnas" :key="item.col">
                  <td><code>{{ item.col }}</code></td>
                  <td>{{ item.desc }}</td>
                </tr>
              </tbody>
            </table>

            <ul class="excel-guide-notes">
              <li v-if="variant === 'usuarios'">
                No se importan usuarios con cédula ya registrada ni filas con campos vacíos.
              </li>
              <li v-if="variant === 'usuarios'">
                Los usuarios importados deben activar su cuenta al primer inicio de sesión.
              </li>
              <li v-if="variant === 'materias'">
                El código no puede repetirse en el archivo ni coincidir con una materia ya registrada.
              </li>
              <li v-if="variant === 'materias'">
                Usa el día con tilde donde aplique (Miércoles, Sábado).
              </li>
            </ul>
          </div>

          <div class="modal-footer modal-footer-actions">
            <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
            <button type="button" class="btn btn-primary" @click="emit('continue')">
              Seleccionar archivo
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.excel-guide-modal {
  max-width: 560px;
}

.excel-guide-body {
  padding: 16px 20px;
  overflow-y: auto;
}

.excel-guide-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.excel-guide-table th,
.excel-guide-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: top;
}

.excel-guide-table th {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.excel-guide-table code {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  background: var(--color-subtle);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--color-text);
}

.excel-guide-notes {
  margin-top: 16px;
  padding-left: 18px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.excel-guide-notes li + li {
  margin-top: 6px;
}

.modal-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 6px;
  line-height: 1.45;
}
</style>
