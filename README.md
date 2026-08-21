# ATAV — Portal académico

**Aplicativos de Trámites Académicos Virtuales** — plataforma web para gestionar procesos académicos (Universidad Santiago de Cali, Derecho Virtual).

| | |
|---|---|
| **Producción** | https://atavportal.web.app |
| **Repositorio** | https://github.com/pregradoderechovirtual0-create/atav |
| **Stack** | Vue 3 · TypeScript · Vite · Firebase (Auth, Firestore, Hosting) |
| **Archivos (PDF)** | Cloudinary (preset `flexibilizaciones_pdf`) |
| **Firebase** | Proyecto `atav-48646` · Hosting `atavportal` |

---

## Inicio rápido

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # compila a dist/
npm run preview      # vista previa del build
```

### Despliegue a producción

```bash
npm run deploy:portal   # build + hosting:atavportal + firestore:rules
npm run deploy:rules    # solo reglas Firestore
npm run deploy:functions# Cloud Function cambiarPasswordUsuario
```

Requisitos: Firebase CLI autenticado (`npx firebase login`) y acceso al proyecto `atav-48646`.

### Seed director (desarrollo)

```bash
npm run seed:director
```

---

## Roles y rutas

| Rol | Prefijo | Vistas |
|-----|---------|--------|
| Estudiante | `/estudiante` | `src/vistas/estudiante/` |
| Docente | `/docente` | `src/vistas/docente/` |
| Director / Jefa Suprema | `/director` | `src/vistas/director/` |

Pantallas compartidas (perfil, calendario, recursos, notificaciones) están en `src/vistas/compartido/` y se montan con rutas por rol.

La protección de rutas y sesión: `src/enrutador/proteccion.ts` y `src/lib/autenticacion/session.ts`.

---

## Estructura del proyecto

```
src/
├── main.ts                 # Arranque (Firebase, router, tema)
├── App.vue                 # Layout global, banner de red, versión
├── style.css               # Estilos globales
│
├── enrutador/
│   ├── index.ts            # createRouter
│   ├── rutas.ts            # Rutas con lazy load
│   └── proteccion.ts       # Guard de sesión y permisos
│
├── configuracion/
│   └── titulosPagina.ts    # Título/subtítulo del header por URL
│
├── vistas/                 # Una pantalla = un archivo Vue
│   ├── autenticacion/      # Login y activación de cuenta
│   ├── director/           # Usuarios, solicitudes, materias, reportes…
│   ├── docente/            # Solicitudes de inasistencia
│   ├── estudiante/         # Flexibilización, habilitaciones, supletorios
│   └── compartido/         # Perfil, calendario, recursos, errores
│
├── componentes/
│   ├── estructura/         # Sidebar, Header, diálogos
│   ├── marca/              # Logo ATAV
│   ├── modales/            # Modales reutilizables
│   ├── formularios/        # Selectores fecha/hora
│   └── controles/          # MateriaPicker, PdfUploadArea, etc.
│
├── composables/            # useNetworkStatus, useNotificaciones…
├── lib/                    # Lógica sin UI
│   ├── firebase.ts
│   ├── autenticacion/      # Login, sesión, reactivar, contraseñas
│   ├── nucleo/             # Roles, rutas, tema, errores, archivos
│   ├── director/           # Agregados y stats del director
│   ├── solicitudes/        # CRUD y caché
│   └── dominio/            # Materias, parciales, notificaciones
│
└── estilos/                # CSS por rol (carga lazy vía rutas)
    ├── responsive.css      # Breakpoints y utilidades móvil
    ├── director-list-page.css
    └── director-modal.css
```

Raíz del repo: `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `functions/`.

---

## ¿Dónde edito qué?

| Quiero cambiar… | Archivo / carpeta |
|-----------------|-------------------|
| Una pantalla o formulario | `src/vistas/{rol}/NombreVista.vue` |
| Menú lateral | `src/componentes/estructura/Sidebar.vue` + `src/lib/nucleo/roles.ts` |
| Rutas URL | `src/enrutador/rutas.ts` |
| Permisos de ruta | `src/lib/autenticacion/session.ts` (`puedeAccederRuta`) |
| Título del header | `src/configuracion/titulosPagina.ts` |
| Login / activar cuenta | `Login.vue` + `src/lib/autenticacion/authLogin.ts` |
| Reactivar cuenta (director) | `ReactivarCuenta.vue` + `reactivarCuenta.ts` |
| Reglas Firestore | `firestore.rules` |
| Cloud Functions | `functions/index.js` |
| Tema por rol | `src/lib/nucleo/theme.ts` + `src/style.css` |
| Materias, parciales, notificaciones | `src/lib/dominio/` |
| Solicitudes docente/estudiante | `src/lib/solicitudes/` + vistas por rol |
| Subida de PDFs | `src/lib/nucleo/erroresOperacion.ts` + `PdfUploadArea.vue` |
| Breakpoints / tablas responsive | `src/estilos/responsive.css` |

---

## Autenticación y cuentas

### Iniciar sesión

- El usuario ingresa **cédula** y **contraseña** (no el correo).
- Internamente se usa el email ficticio `{cedula}@atav.com` en Firebase Auth.
- La contraseña se valida contra `password_hash` en Firestore (PBKDF2 en `passwordUtils.ts`).
- Si Auth y Firestore están desincronizados (`authDesincronizado`, contraseña temporal, etc.), el login puede usar **sesión anónima** + colección `auth_vinculos` (requiere proveedor Anónimo activo en Firebase Console).

### Activar cuenta (primer ingreso o tras reactivación)

1. En login → **«Activa tu cuenta»**.
2. Cédula + nueva contraseña (mínimo 6 caracteres).
3. Si el email **no** existe en Auth → `createUserWithEmailAndPassword` + actualización Firestore.
4. Si el email **ya** existe (cuenta reactivada, usuario antiguo) → **no** se llama a `signUp`; se detecta con `fetchSignInMethodsForEmail` o flags `reactivacionPendiente` / `auth_uid`, y se guarda el hash vía sesión anónima + `auth_vinculos` (`activarCuentaConEmailYaEnAuth`).

### Reactivar cuenta (director)

- Ruta: `/director/reactivar-cuenta/:cedula` (desde edición de usuario en **Usuarios**).
- **No borra** nombre, rol, historial ni datos del perfil.
- Resetea acceso: `registrado: false`, elimina `password_hash`, marca `reactivacionPendiente: true`.
- El usuario debe usar **«Activa tu cuenta»** y crear una contraseña nueva.

### Restablecer contraseña

- El usuario solicita por correo institucional (modal en login).
- Administración puede asignar contraseña temporal o reactivar la cuenta (flujo preferido: reactivar → usuario activa).

---

## Experiencia de usuario (detalles implementados)

### Login responsive

- **Desktop (>1024px):** tarjeta con efecto flip entre «Iniciar sesión» y «Activa tu cuenta»; altura fija con scroll interno en campos si el contenido crece.
- **Móvil/tablet (≤1024px):** sin flip 3D; una vista a la vez; formulario en flujo natural (sin aplastar botones).
- **Avisos de error/éxito:** cajas con fondo (`form-alert`), separadas del botón principal; el botón **Ingresar** / **Activar cuenta** mantiene `min-height: 46px` y no se superpone con «¿Primera vez?» / «¿Ya tienes cuenta?».
- **≤480px:** «Recordarme» y «¿Olvidaste tu contraseña?» en columna; textos de alerta ligeramente más pequeños.

Breakpoints centralizados en `src/estilos/responsive.css` (`--bp-lg: 1024px`, `--bp-xs: 480px`, etc.).

### App interna (tras login)

- Sidebar colapsable; tablas con scroll horizontal en pantallas pequeñas.
- Bandeja del director y formularios de solicitudes adaptados a móvil (CSS en vistas y `director-list-page.css`).
- Banner de **sin conexión** (`useNetworkStatus` en `App.vue`) cuando `navigator.onLine` es falso.

### Formularios y archivos

- PDFs: máximo **5 MB** (`src/lib/nucleo/archivos.ts`); validación en `PdfUploadArea` y antes de subir a Cloudinary.
- Errores de red al enviar solicitudes: mensajes claros, datos del formulario **no se borran**; opción de reintentar (`erroresOperacion.ts`).
- Códigos Firebase frecuentes traducidos: `permission-denied`, `unavailable`, sin conexión.

### Versión y caché

- `version.json` en build; detección de nueva versión para evitar chunks obsoletos tras deploy (`appVersion.ts`).

---

## Seguridad (Firestore)

Las reglas (`firestore.rules`) aplican, entre otras cosas:

- Lectura de `usuarios` limitada por rol, cédula o estados de activación (`registrado: false`, etc.).
- El director puede crear usuarios y actualizar campos de gestión; estudiantes/docentes solo campos permitidos en su perfil.
- Actualización de solicitudes por director restringida a `estado`, `motivo_rechazo`, `historial`, `actualizado_en`.
- Activación de cuenta con sesión anónima solo si `auth_vinculos` coincide con la cédula y campos de activación permitidos.
- Índice `indices/director_uids` para validar notificaciones a directores.

Tras cambiar reglas: `npm run deploy:rules` o `npm run deploy:portal`.

---

## Buenas prácticas del proyecto

### Código

1. **Lógica en `lib/`, UI en `vistas/`** — no mezclar Firestore complejo dentro del template.
2. **Imports con alias** `@/` → `src/`.
3. **Rutas lazy** — nuevas pantallas en `rutas.ts` con `() => import(...)`.
4. **Tipos** — TypeScript en `.ts` y `<script setup lang="ts">` en Vue.
5. **Diálogos** — `dialog.confirm()` / `dialog.alert()` desde `@/lib/nucleo/dialog` (no `window.confirm` suelto).
6. **Errores de operación** — usar `mensajeErrorEnvio`, `confirmarReintento`, `alertaSinConexion` en formularios que escriben a Firestore.
7. **Contraseñas** — nunca guardar texto plano; solo `password_hash` o Firebase Auth.

### Git y despliegue

- **`main`** = producción. Evitar push directo; usar ramas `feature/*` y Pull Request (ver [TRABAJO_COMPARTIDO.md](./TRABAJO_COMPARTIDO.md)).
- **No commitear** `dist/`, `.env`, credenciales ni `node_modules` (ya en `.gitignore`).
- Desplegar hosting **después** de `npm run build` exitoso.
- Si cambias `firestore.rules`, despliega reglas en el mismo ciclo que el front cuando el cambio es dependiente.

### Firebase Console (checklist)

- Authentication → Sign-in method: **Email/Password** y **Anónimo** habilitados.
- Firestore rules publicadas y coherentes con el código del cliente.
- Hosting site `atavportal` apuntando a `dist/`.

### CSS

- Variables de tema en `style.css` (`--color-primary`, etc.).
- Estilos de director: preferir `director-list-page.css` y `director-modal.css` para consistencia.
- Probar cambios de layout en **1024px, 768px y 480px** (login + una vista de bandeja).

---

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build local |
| `npm run deploy:portal` | Build + deploy hosting + rules |
| `npm run deploy:rules` | Solo `firestore.rules` |
| `npm run deploy:functions` | Cloud Functions |
| `npm run seed:director` | Seed de director (script local) |

---

## Documentación adicional

| Archivo | Contenido |
|---------|-----------|
| [TRABAJO_COMPARTIDO.md](./TRABAJO_COMPARTIDO.md) | Flujo Git en equipo, PRs, deploy |
| [LECCIONES_APRENDIDAS.md](./LECCIONES_APRENDIDAS.md) | Notas y aprendizajes del proyecto |

---

## Licencia y contacto

Proyecto académico — Universidad Santiago de Cali, Derecho Virtual.

Soporte institucional (restablecimiento de contraseña): `derechovirtual@usc.edu.co`.
