<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { dialog } from '@/lib/dialog'

interface Solicitud {
  id: string
  tipo: 'supletorio' | 'habilitacion' | 'inasistencia'
  fecha: string
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'correccion'
  datos: Record<string, any>
  descripcion?: string
  materia?: string
}

defineProps<{
  solicitudes: Solicitud[]
}>()

const emit = defineEmits<{
  eliminar: [id: string]
  editar: [id: string, solicitud: Solicitud]
}>()

const solicitudExpandida = ref<string | null>(null)
const solicitudEnEdicion = ref<string | null>(null)

const toggleExpanded = (id: string) => {
  solicitudExpandida.value = solicitudExpandida.value === id ? null : id
}

const getEstadoClass = (estado: string) => {
  return {
    'estado-pendiente': estado === 'pendiente',
    'estado-aprobada': estado === 'aprobada',
    'estado-rechazada': estado === 'rechazada',
    'estado-correccion': estado === 'correccion'
  }
}

const getEstadoLabel = (estado: string) => {
  const labels: Record<string, string> = {
    'pendiente': 'Pendiente',
    'aprobada': 'Aprobada',
    'rechazada': 'Rechazada',
    'correccion': 'Requiere corrección'
  }
  return labels[estado] || estado
}

const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    'supletorio': 'Solicitud de Supletorio',
    'habilitacion': 'Solicitud de Habilitación',
    'inasistencia': 'Justificación de Inasistencia'
  }
  return labels[tipo] || tipo
}

const getTipoIcon = (tipo: string) => {
  const icons: Record<string, string> = {
    'supletorio': '📚',
    'habilitacion': '🎓',
    'inasistencia': '🚫'
  }
  return icons[tipo] || '📋'
}

const handleEliminar = async (id: string) => {
  const ok = await dialog.confirm('¿Estás seguro de que deseas eliminar esta solicitud?', {
    title: 'Eliminar solicitud',
    variant: 'danger',
    confirmText: 'Eliminar',
  })
  if (ok) emit('eliminar', id)
}

const handleEditar = async (_solicitud: Solicitud) => {
  await dialog.alert('Funcionalidad de edición disponible pronto')
}
</script>

<template>
  <div class="lista-solicitudes">
    <!-- Estado vacío -->
    <div v-if="solicitudes.length === 0" class="estado-vacio">
      <div class="vacio-icon">📭</div>
      <h3 class="vacio-titulo">No hay solicitudes</h3>
      <p class="vacio-descripcion">
        Aún no has creado ninguna solicitud. ¡Empieza por crear una nueva!
      </p>
    </div>

    <!-- Lista de solicitudes -->
    <div v-else class="solicitudes-container">
      <div v-for="solicitud in solicitudes" :key="solicitud.id" class="solicitud-card">
        <!-- Header de la solicitud -->
        <div class="solicitud-header" @click="toggleExpanded(solicitud.id)">
          <div class="solicitud-header-left">
            <span class="tipo-icon">{{ getTipoIcon(solicitud.tipo) }}</span>
            <div class="header-info">
              <h3 class="solicitud-numero">
                Solicitud #{{ solicitud.id }}
              </h3>
              <p class="solicitud-tipo">{{ getTipoLabel(solicitud.tipo) }}</p>
            </div>
          </div>
          <div class="solicitud-header-right">
            <span :class="['estado-badge', getEstadoClass(solicitud.estado)]">
              {{ getEstadoLabel(solicitud.estado) }}
            </span>
            <span class="expand-icon">
              {{ solicitudExpandida.value === solicitud.id ? '▼' : '▶' }}
            </span>
          </div>
        </div>

        <!-- Contenido expandido -->
        <transition name="expandir">
          <div v-if="solicitudExpandida.value === solicitud.id" class="solicitud-content">
            <!-- Info general -->
            <div class="content-section">
              <h4 class="section-title">Información General</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">ID Solicitud</span>
                  <span class="info-value">{{ solicitud.id }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Fecha</span>
                  <span class="info-value">{{ solicitud.fecha }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Estado</span>
                  <span :class="['info-estado', getEstadoClass(solicitud.estado)]">
                    {{ getEstadoLabel(solicitud.estado) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Datos específicos -->
            <div class="content-section">
              <h4 class="section-title">Detalles de la Solicitud</h4>
              <div class="datos-grid">
                <div v-for="(valor, clave) in solicitud.datos" :key="clave" class="dato-item">
                  <span class="dato-label">{{ formatearEtiqueta(clave) }}</span>
                  <span class="dato-valor">{{ valor }}</span>
                </div>
              </div>
            </div>

            <!-- Descripción o materia -->
            <div v-if="solicitud.descripcion || solicitud.materia" class="content-section">
              <h4 class="section-title">Observaciones</h4>
              <p v-if="solicitud.materia" class="observation-text">
                <strong>Materia:</strong> {{ solicitud.materia }}
              </p>
              <p v-if="solicitud.descripcion" class="observation-text">
                <strong>Descripción:</strong> {{ solicitud.descripcion }}
              </p>
            </div>

            <!-- Acciones -->
            <div class="solicitud-actions">
              <Button
                @click="handleEditar(solicitud)"
                class="btn-editar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar
              </Button>
              <Button
                @click="handleEliminar(solicitud.id)"
                class="btn-eliminar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
                Eliminar
              </Button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const formatearEtiqueta = (clave: string) => {
  return clave
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}
</script>

<style scoped>
.lista-solicitudes {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Estado vacío */
.estado-vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  background: #f9fafb;
  border: 2px dashed #d1d5db;
  border-radius: 0.75rem;
}

.vacio-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.vacio-titulo {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.vacio-descripcion {
  margin: 0.5rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

/* Container de solicitudes */
.solicitudes-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.solicitud-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #fff;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.solicitud-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* Header de solicitud */
.solicitud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  background: #f9fafb;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.solicitud-header:hover {
  background: #f3f4f6;
}

.solicitud-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.tipo-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.solicitud-numero {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
}

.solicitud-tipo {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.solicitud-header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.estado-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.estado-pendiente {
  background: #fef3c7;
  color: #92400e;
}

.estado-aprobada {
  background: #d1fae5;
  color: #065f46;
}

.estado-rechazada {
  background: #fee2e2;
  color: #7f1d1d;
}

.estado-correccion {
  background: #e0e7ff;
  color: #3730a3;
}

.expand-icon {
  font-size: 0.75rem;
  color: #6b7280;
  transition: transform 0.2s;
}

/* Contenido expandido */
.solicitud-content {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
}

.info-value {
  font-size: 0.95rem;
  color: #1a1a1a;
  font-weight: 500;
}

.info-estado {
  display: inline-block;
  width: fit-content;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.datos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.dato-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dato-label {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
}

.dato-valor {
  font-size: 0.95rem;
  color: #1a1a1a;
  word-break: break-word;
}

.observation-text {
  margin: 0;
  font-size: 0.95rem;
  color: #4b5563;
  line-height: 1.5;
}

/* Acciones */
.solicitud-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.btn-editar,
.btn-eliminar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-editar {
  background: #3b82f6;
  color: white;
}

.btn-editar:hover {
  background: #2563eb;
}

.btn-eliminar {
  background: #ef4444;
  color: white;
}

.btn-eliminar:hover {
  background: #dc2626;
}

/* Animación de expansión */
.expandir-enter-active,
.expandir-leave-active {
  transition: all 0.3s ease;
}

.expandir-enter-from {
  opacity: 0;
  max-height: 0;
}

.expandir-leave-to {
  opacity: 0;
  max-height: 0;
}

/* Responsivo */
@media (max-width: 768px) {
  .solicitud-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .solicitud-header-right {
    width: 100%;
    justify-content: space-between;
  }

  .info-grid,
  .datos-grid {
    grid-template-columns: 1fr;
  }

  .solicitud-actions {
    flex-direction: column;
  }

  .btn-editar,
  .btn-eliminar {
    width: 100%;
  }
}
</style>
