# ATAV — Portal académico

Aplicativo web para trámites académicos virtuales (Universidad Santiago de Cali).

**Stack:** Vue 3 · TypeScript · Vite · Firebase (Auth, Firestore, Hosting)

**Producción:** https://atavportal.web.app

---

## Inicio rápido

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # compila a dist/
npm run deploy:portal
```

---

## Estructura del proyecto

```
src/
├── main.ts                 # Arranque de la app
├── App.vue                 # Layout global (sidebar, header, router-view)
├── style.css               # Estilos globales
│
├── enrutador/              # Rutas y protección por rol
│   ├── index.ts            # createRouter
│   ├── rutas.ts            # Todas las rutas (lazy load)
│   └── proteccion.ts       # Guard de sesión y permisos
│
├── configuracion/
│   └── titulosPagina.ts    # Títulos del header por ruta
│
├── vistas/                 # Páginas (una por pantalla)
│   ├── autenticacion/      # Login y registro
│   ├── director/           # Panel directora
│   ├── docente/            # Panel docente
│   ├── estudiante/         # Panel estudiante
│   └── compartido/         # Perfil, calendario, recursos, errores
│
├── componentes/
│   ├── estructura/         # Sidebar, Header, AppDialog
│   ├── marca/              # Logo ATAV
│   ├── modales/            # Modales reutilizables
│   └── controles/          # MateriaPicker, PdfUpload, etc.
│
├── composables/            # Lógica Vue reutilizable
├── lib/                    # Lógica de negocio (sin UI)
│   ├── firebase.ts         # Conexión Firebase
│   ├── autenticacion/      # Login, sesión, contraseñas
│   ├── nucleo/             # Roles, rutas, tema, diálogos
│   ├── director/           # Stats y agregados del director
│   ├── solicitudes/        # CRUD y cache de solicitudes
│   └── dominio/            # Materias, parciales, notificaciones
│
└── estilos/                # CSS por rol/página (carga lazy)
```

---

## ¿Dónde edito qué?

| Quiero cambiar… | Archivo / carpeta |
|-----------------|-------------------|
| Una pantalla o formulario | `src/vistas/{rol}/NombreVista.vue` |
| Menú lateral o navegación | `src/componentes/estructura/Sidebar.vue` + `src/lib/nucleo/roles.ts` |
| Rutas URL | `src/enrutador/rutas.ts` |
| Quién puede entrar a una ruta | `src/lib/autenticacion/session.ts` (`puedeAccederRuta`) |
| Título del header | `src/configuracion/titulosPagina.ts` |
| Login / contraseña | `src/lib/autenticacion/authLogin.ts` + `src/vistas/autenticacion/Login.vue` |
| Reglas de Firestore | `firestore.rules` (raíz) |
| Cloud Functions | `functions/index.js` |
| Estilos globales / tema | `src/style.css` + `src/lib/nucleo/theme.ts` |
| Materias, parciales, notificaciones | `src/lib/dominio/` |
| Solicitudes (docente/estudiante) | `src/lib/solicitudes/` |
| Dashboard del director | `src/vistas/director/DirectorDashboard.vue` + `src/lib/director/` |

---

## Roles

| Rol | Ruta base | Carpeta de vistas |
|-----|-----------|-------------------|
| Estudiante | `/estudiante` | `vistas/estudiante/` |
| Docente | `/docente` | `vistas/docente/` |
| Director / Jefa Suprema | `/director` | `vistas/director/` |

Páginas compartidas (calendario, recursos, perfil) viven en `vistas/compartido/` y se montan con rutas por rol.

---

## Firebase

- **Proyecto:** `atav-48646`
- **Hosting:** `atavportal`
- **Config cliente:** `src/lib/firebase.ts`
- **Seed director:** `npm run seed:director`

---

## Convenciones

- Imports con alias `@/` → `src/`
- Lógica de negocio en `lib/`, no en las vistas
- Vistas grandes: extraer componentes a `componentes/` o composables
- Diálogos de confirmación: `dialog.confirm()` desde `@/lib/nucleo/dialog`
