# Lecciones aprendidas — ATAV V2

Documento de referencia para evitar repetir errores al modificar el proyecto.
**Revisar este archivo antes de cada cambio.**

---

## Arquitectura del proyecto

- **Stack:** Vue 3 + Vite + TypeScript + Firebase (Auth + Firestore) + Tailwind CSS 4.
- **Rutas estudiante reales:** flexibilización, habilitaciones y supletorios (`/estudiante/flexibilidad`, `/estudiante/habilitaciones`, `/estudiante/supletorios`).
- **Colecciones Firestore por tipo de solicitud estudiante:**
  - `flexibilizaciones`
  - `habilitaciones`
  - `supletorios`
- **Campo común:** `estudiante_id` = `auth.currentUser.uid` (no la cédula).

---

## Qué NO hacer

### Dashboard y navegación estudiante

- **NO** mostrar en el dashboard del estudiante flujos legacy de ausencia, justificación o reprogramación. Esos eran placeholders sin persistencia en Firestore.
- **NO** enlazar el dashboard estudiante a `/estudiante/crear-solicitud?tipo=...` — esa ruta es un stub sin guardado real.
- **NO** reutilizar `docente/MisSolicitudes.vue` para estudiantes sin adaptarlo (tiene datos mock de docente y enlaces a rutas `/docente/*`).
- **NO** crear rutas rotas como `/estudiante/solicitudes/` — usar `/estudiante` o la ruta específica del tipo.

### Firestore y datos

- **NO** mezclar colecciones: las solicitudes de estudiante no van en `solicitudes` (esa es para docentes).
- **NO** filtrar por cédula si el documento guarda `estudiante_id` como UID de Firebase Auth.
- **NO** asumir que habilitaciones/supletorios aparecen en `DirectorSolicitudes.vue` — hoy solo carga `solicitudes` y `flexibilizaciones`.

### Componentes y código muerto

- **NO** importar componentes no usados (`FormularioInasistencia`, `ListaSolicitudes`, etc.) sin verificar que estén conectados a una vista.
- **NO** confiar en props de usuario pasadas desde `App.vue` al `Sidebar` — el sidebar carga el usuario real desde Firestore en `onMounted`.

### UX y consistencia

- **NO** usar estados inconsistentes entre páginas (`Pendiente` vs `En revisión` vs `pendiente` en Firestore). Mapear siempre desde el valor en Firestore.
- **NO** olvidar formatear fechas de `serverTimestamp()` con `.toDate()` antes de mostrarlas.

### Notificaciones

- **NO** usar `orderBy('fecha_creacion')` junto con `where('usuario_id')` sin índice compuesto en Firestore — ordenar en el cliente.
- **NO** dejar datos mock en `Header.vue` — debe leer de Firestore en tiempo real.
- **NO** usar rutas rotas en el campo `ruta` (`/estudiante/mis-solicitudes` no es la página correcta).
- **NO** notificar directores sin `auth_uid` en su documento de `usuarios` — guardarlo al iniciar sesión.

---

## Qué SÍ hacer

- El **dashboard estudiante** debe agregar solicitudes de las tres colecciones y mostrar accesos rápidos para crear nuevas.
- El **sidebar estudiante** debe enlazar a las páginas donde se listan y crean solicitudes por tipo.
- Al agregar un enlace de cancelar/volver, apuntar a una ruta registrada en `main.ts`.
- Seguir el patrón visual de tarjetas de solicitudes usado en `EstudianteFlexibilidad.vue`.
- Actualizar este documento cuando se descubra un nuevo antipatrón o se corrija un error recurrente.
- Usar `src/lib/notificaciones.ts` y `useNotificaciones` para crear y leer notificaciones.
- Guardar `auth_uid` en `usuarios/{cedula}` al login para poder notificar directores.
- Al aprobar/rechazar, enviar `ruta` según el tipo de solicitud y rol del destinatario.

---

## Historial de cambios

| Fecha | Cambio | Lección |
|-------|--------|---------|
| 2026-06-28 | Notificaciones conectadas a Firestore (página, header, creación) | Evitar orderBy+where sin índice; no usar mock en Header |
| 2026-06-28 | Dashboard estudiante reescrito: quitados cards legacy, agregado listado unificado y acciones rápidas | No dejar UI legacy visible si el backend no existe |
| 2026-06-28 | Reglas Firestore en `firestore.rules` (incluye `parciales/rangos`) | Desplegar con `firebase deploy --only firestore:rules` |
