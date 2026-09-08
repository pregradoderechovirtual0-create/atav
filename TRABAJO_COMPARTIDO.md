# Trabajo compartido — ATAV V3

Guía para trabajar en equipo (1, 2, 3 o 4 personas) sin pisarse cambios y con **producción estable**.

---

## Reglas básicas

| Concepto | Significado |
|----------|-------------|
| **`main`** | Rama de producción. Lo que está aquí es lo que debe estar en Firebase. |
| **Ramas `feature/*`** | Trabajo diario de cada persona. |
| **`atavportal.web.app`** | Producción (hosting `atavportal`). |
| **`dist/`** | No se sube a Git (se genera con `npm run build`). |

**Regla de oro:** nadie hace push directo a `main`. Todo entra por **Pull Request (PR)**.

---

## Antes de empezar (cada persona, una sola vez)

### 1. Clonar el repositorio

```powershell
git clone https://github.com/pregradoderechovirtual0-create/atav.git
cd atav
npm install
```

### 2. Configurar Git con tu cuenta de GitHub

Usa el **nombre y email** de la cuenta con la que colaboras en este repo:

```powershell
git config user.name "TuUsuarioGitHub"
git config user.email "tu-email@users.noreply.github.com"
```

> El email `noreply` lo encuentras en GitHub → **Settings → Emails**.

### 3. Correr el proyecto en local

```powershell
npm run dev
```

Abre la URL que muestra Vite (normalmente `http://localhost:5173`).

### 4. Acceso al repo

El dueño del repo debe invitarte en:

**GitHub → Repo → Settings → Collaborators → Add people** (rol **Write**).

---

## Flujo diario (todas las personas)

Repite esto cada vez que vayas a trabajar:

```powershell
# 1. Actualizar main
git checkout main
git pull origin main

# 2. Crear rama para TU tarea (nombre corto y claro)
git checkout -b feature/descripcion-corta

# 3. Trabajar, probar en local (npm run dev)
# ...

# 4. Guardar cambios
git add .
git commit -m "tipo: descripcion clara del cambio"

# 5. Subir TU rama (nunca main directo)
git push -u origin feature/descripcion-corta
```

Luego en GitHub:

1. Aparece **Compare & pull request**
2. Base: **`main`**
3. Describe qué cambiaste
4. Crea el PR
5. Otro compañero (o tú) revisa y **Merge**

Después del merge:

```powershell
git checkout main
git pull origin main
```

---

## Cómo evitar que se crucen los cambios

Funciona igual si son 2, 3 o 4 personas:

1. **`git pull origin main` antes de empezar** cada día o cada sesión.
2. **Una rama por persona y por tarea** — no compartir la misma rama.
3. **PRs pequeños** — un fix o una feature por PR; más fácil de revisar y menos conflictos.
4. **Avisar en el grupo** si vas a tocar archivos sensibles:
   - `firestore.rules`
   - `functions/`
   - `src/lib/autenticacion/`
   - `src/enrutador/`
   - Login, sesión, roles
5. **No editar el mismo archivo a la vez** sin coordinarse.
6. **Mergear seguido** — no dejar ramas abiertas muchos días.

### Reparto sugerido (equipos de 3–4)

| Área | Ejemplos |
|------|----------|
| Frontend / vistas | `src/vistas/`, `src/componentes/` |
| Lógica / datos | `src/lib/` |
| Auth y sesión | `src/lib/autenticacion/`, `Login.vue` |
| Firebase backend | `firestore.rules`, `functions/` |

Cada uno puede tener su “zona”, pero siempre por rama y PR.

---

## Si hay conflicto de merge

GitHub lo marca en el PR. En local:

```powershell
git checkout feature/tu-rama
git pull origin main
```

Abre los archivos con marcas `<<<<<<<`, elige qué código queda, borra las marcas, luego:

```powershell
git add .
git commit -m "merge: resolver conflicto con main"
git push
```

Si no estás seguro, **no mergees solo** — pregunta a quien tocó el otro lado del conflicto.

---

## Producción: `main` → Firebase

**Solo lo mergeado en `main` debe ir a producción.**

| Sitio Firebase | URL | Uso |
|----------------|-----|-----|
| `atavportal` | https://atavportal.web.app | **Producción** |
| `atav-48646` | Hosting legacy | No usar para releases nuevos |

### Despliegue manual (recomendado al inicio)

**Una persona** hace deploy después de mergear a `main` (acuerden quién):

```powershell
git checkout main
git pull origin main
npm run deploy:portal
```

Eso ejecuta:

- `npm run build`
- `firebase deploy --only hosting:atavportal,firestore:rules`

### Requisitos para desplegar

```powershell
firebase login
```

En Firebase Console → proyecto **atav-48646** → **Project settings → Users and permissions**: solo quien despliega necesita rol **Editor** (o superior).

**Importante:** si cambias `firestore.rules` o `functions/`, el deploy afecta a todos los usuarios. Revisar en PR antes de mergear.

---

## Proteger la rama `main` (dueño del repo)

En GitHub → **Settings → Branches → Add branch protection rule**:

- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ (Opcional) Require approvals: **1**

Así nadie sube a producción por accidente.

---

## Mensajes de commit (convención simple)

```
tipo: descripcion breve
```

| Tipo | Cuándo |
|------|--------|
| `feat` | Feature nueva |
| `fix` | Corrección de bug |
| `refactor` | Reorganizar sin cambiar comportamiento |
| `docs` | Solo documentación |
| `style` | CSS / UI sin lógica |
| `chore` | Dependencias, config, scripts |

Ejemplos:

```
fix: login fallaba en primer intento
feat: filtro por estado en solicitudes del director
docs: actualizar TRABAJO_COMPARTIDO
```

---

## Checklist antes de abrir un PR

- [ ] Partí de `main` actualizado (`git pull`)
- [ ] Probé en local (`npm run dev`)
- [ ] El build pasa (`npm run build`)
- [ ] No commiteé `.env`, secretos ni `dist/`
- [ ] El PR describe **qué** cambia y **por qué**
- [ ] Si toqué reglas de Firestore, lo mencioné en el PR

---

## Checklist antes de desplegar a producción

- [ ] El PR ya está **mergeado en `main`**
- [ ] Hice `git pull origin main`
- [ ] `npm run build` termina sin errores
- [ ] Sé qué cambia en `firestore.rules` (si aplica)
- [ ] Ejecuto `npm run deploy:portal`

---

## Equipos de distinto tamaño

### 1 persona

Mismo flujo (rama + PR) ayuda a no romper producción. Deploy desde `main` cuando estés listo.

### 2 personas

Uno revisa el PR del otro. Acuerden quién despliega (o los dos con cuidado de no hacer deploy simultáneo).

### 3–4 personas

- PR obligatorio + 1 aprobación en `main`
- Una persona “release” hace deploy ese día, o turnos semanales
- Canal de chat para avisar: “toco login”, “toco firestore.rules”, “deploy en 5 min”

---

## Cursor / IA en el equipo

Si usan Cursor u otra IA para commits:

- **Cursor Settings → Git & PRs → Attribution → Commit Attribution: OFF**  
  (evita `Co-authored-by: Cursor` y contributors extraños)
- Revisar el diff antes de commit — la IA no reemplaza la revisión humana
- No commitear archivos generados por error (`dist/`, `.env`)

---

## Comandos útiles

```powershell
# Ver en qué rama estás
git branch

# Ver estado de archivos
git status

# Ver últimos commits
git log --oneline -10

# Descartar cambios locales en un archivo (cuidado)
git checkout -- ruta/al/archivo

# Actualizar tu rama con main
git pull origin main

# Build de producción (sin desplegar)
npm run build

# Solo reglas de Firestore
npm run deploy:rules
```

---

## Resumen en una imagen

```
Persona A ── feature/login ──┐
Persona B ── feature/tablas ──┼──► PR ──► main ──► npm run deploy:portal ──► atavportal.web.app
Persona C ── feature/reportes ┘
```

**`main` = verdad en Git = producción en Firebase.**

---

## Dudas frecuentes

**¿Puedo pushear directo a `main`?**  
No, salvo emergencia y acuerdo del equipo.

**¿Subo `dist/` para que el otro lo vea?**  
No. Cada uno corre `npm run build` en local si hace falta.

**¿Dos personas despliegan a la vez?**  
Evitarlo. Un deploy a la vez desde `main`.

**¿Dónde está el repo?**  
https://github.com/pregradoderechovirtual0-create/atav

**¿Dónde está producción?**  
https://atavportal.web.app
