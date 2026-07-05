# Supabase Auth — Creator AI Studio

Login de usuarios con **Supabase Auth** (email/contraseña). Separado del OAuth de Google (Gemini/YouTube en Configuración).

## Proyecto staging (Creator AI Studio)

| Campo | Valor |
|-------|--------|
| Project ref | `iiokqyedkylwhonbrrvo` |
| API URL | `https://iiokqyedkylwhonbrrvo.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/iiokqyedkylwhonbrrvo |
| Org | Creator AI Studio (`mesanqmzbpcvbtifipfx`) |

Repo enlazado: `supabase link --project-ref iiokqyedkylwhonbrrvo` ✓

## Requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase login`)
- Org: `mesanqmzbpcvbtifipfx` (**Creator AI Studio** — no reutilizar `nugacore-staging` / apuestas)

## 1. Crear proyecto (CLI)

```powershell
cd creator-ai-studio
$env:SUPABASE_INTERNAL_NO_POSTHOG = "true"

# Contraseña de DB (guárdala en tu gestor de secretos, no en git)
$env:SUPABASE_DB_PASSWORD = "tu-password-seguro-32+"

supabase projects create creator-ai-studio `
  --org-id mesanqmzbpcvbtifipfx `
  --region us-east-1 `
  --db-password $env:SUPABASE_DB_PASSWORD
```

Anota el **project ref** (ej. `abcdefghijklmnop`).

## 2. Enlazar y aplicar migraciones

```powershell
supabase link --project-ref iiokqyedkylwhonbrrvo
supabase db push -p "TU_DATABASE_PASSWORD" --yes
```

O script interactivo:

```powershell
.\scripts\supabase-create-and-push.ps1 -ProjectRef iiokqyedkylwhonbrrvo
```

La contraseña está en **Dashboard → Project Settings → Database** (la que elegiste al crear el proyecto).

Migraciones en `supabase/migrations/`:

- `001_initial.sql` — episodios, canales, jobs
- `20250625120000_auth_profiles_rls.sql` — perfiles, `user_id`, RLS

## 3. URLs de auth (Dashboard)

**Authentication → URL Configuration**

| Campo | Valor |
|-------|--------|
| Site URL | `https://creator-ai-studio.217.76.56.66.sslip.io` |
| Redirect URLs | `https://creator-ai-studio.217.76.56.66.sslip.io/**`, `http://localhost:5173/**` |

**Authentication → Providers** — Email habilitado (confirmación opcional en staging).

## 4. Variables en Coolify / staging

### Importante: Vite solo en build time

`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se **incrustan en el JS estático** al construir la imagen web (`deploy/Dockerfile.web`). No sirve añadirlas como variables de runtime en Coolify para el contenedor nginx: hay que **reconstruir** la imagen web con `--build-arg`.

| Variable | Dónde | Uso |
|----------|--------|-----|
| `VITE_SUPABASE_URL` | **Build** web | Cliente Supabase en el navegador |
| `VITE_SUPABASE_ANON_KEY` | **Build** web | Cliente Supabase en el navegador |
| `SUPABASE_URL` | API (runtime) | Sync Postgres + JWKS fallback; alias para derivar `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | VPS / CI | Alias para derivar `VITE_SUPABASE_ANON_KEY` en el build |
| `SUPABASE_JWT_SECRET` | API (runtime) | Validar JWT (`Project Settings → API → JWT Secret`) |
| `SUPABASE_SERVICE_ROLE_KEY` | API (opcional) | Sync Postgres |
| `CAS_API_KEY` | API + worker | Auth máquina-a-máquina (worker) |

Endpoint público de diagnóstico: `GET /api/auth/status` → `{ authRequired, apiKeyAuth, supabaseAuth }`.

Si la API tiene `SUPABASE_JWT_SECRET` pero la web se construyó **sin** `VITE_*`, verás la pantalla **«Configuración requerida — Inicio de sesión no disponible»** y `401` en rutas protegidas.

### Opción A — GitHub Actions (recomendado)

En el repo **Settings → Secrets and variables → Actions**, define:

| Secret | Valor |
|--------|--------|
| `SUPABASE_URL` | `https://iiokqyedkylwhonbrrvo.supabase.co` |
| `SUPABASE_ANON_KEY` | Dashboard → Settings → API → **anon** o **publishable** key |
| `SUPABASE_JWT_SECRET` | Dashboard → Settings → API → **JWT Secret** |
| `SUPABASE_SERVICE_ROLE_KEY` | (opcional) service role |
| `CAS_API_KEY` | (opcional) clave para el worker |
| `CAS_SECRETS_KEY` | (opcional) cifrado de claves en UI |

Cada push a `staging` ejecuta `scripts/vps-sync-supabase-env.sh` (escribe `/root/creator-ai-studio/.env.supabase.local`) y `scripts/vps-redeploy.sh` (build con `--build-arg VITE_SUPABASE_*`).

### Opción B — Archivo manual en el VPS

SSH al VPS y crea o edita `/root/creator-ai-studio/.env.supabase.local` (no commitear):

```bash
SUPABASE_URL=https://iiokqyedkylwhonbrrvo.supabase.co
SUPABASE_ANON_KEY=<anon-o-publishable-key-del-dashboard>
SUPABASE_JWT_SECRET=<jwt-secret-del-dashboard>
# opcional:
# SUPABASE_SERVICE_ROLE_KEY=
# CAS_API_KEY=
# CAS_SECRETS_KEY=
```

`vps-sync-supabase-env.sh` y `vps-redeploy.sh` derivan `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` desde `SUPABASE_URL` / `SUPABASE_ANON_KEY` si no están explícitos.

### Rebuild obligatorio (web)

Tras definir las variables, **reconstruye la imagen web** (no basta con reiniciar el contenedor):

```bash
cd /root/creator-ai-studio
bash scripts/vps-redeploy.sh manual-$(date +%Y%m%d)
```

O dispara un deploy con push a `staging` (si los secrets de GitHub están configurados).

`vps-redeploy.sh` falla si `SUPABASE_JWT_SECRET` está definido pero faltan las claves para el build web, y verifica que la URL de Supabase quedó embebida en los assets estáticos.

### Coolify: qué no hacer

- No uses solo **Restart** en Coolify para el servicio web: no recompila Vite.
- El redeploy real lo hace `scripts/vps-redeploy.sh` vía GitHub Actions (build `docker build` + actualización del compose de Coolify).
- Si construyes a mano con `docker compose -f deploy/docker-compose.staging.yml up --build`, exporta `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el shell o en un `.env` junto al compose antes del build.

Con auth activa, las rutas `/api/*` (excepto health, auth/status y OAuth) requieren `Authorization: Bearer <access_token>` o `CAS_API_KEY`.

## 5. Desarrollo local

```powershell
npm run supabase:start    # Postgres + Auth local (Docker)
npm run supabase:status   # URL, anon key, JWT secret local
npm run supabase:reset    # Aplica migraciones + seed
```

Copia en `.env` / `apps/web/.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key de supabase status>
SUPABASE_JWT_SECRET=<JWT secret de supabase status>
```

## 6. Flujo en la app

1. Web: `LoginView` si hay `VITE_SUPABASE_*` y no hay sesión.
2. `AuthContext` guarda el access token y lo envía a la API.
3. API: `registerAuthHook` verifica JWT y expone `request.userId`.

## Scripts npm

| Script | Acción |
|--------|--------|
| `npm run supabase:link` | Enlazar proyecto remoto |
| `npm run supabase:push` | `supabase db push` |
| `npm run supabase:start` | Stack local |
| `npm run supabase:reset` | Reset DB local |

## Notas

- Sin `VITE_SUPABASE_*`, la web muestra una pantalla de **configuración requerida** cuando `/api/auth/status` indica `authRequired: true` (no intenta cargar el dashboard sin login).
- OAuth Google en Configuración ≠ login Supabase; son flujos distintos.
- Fase 2: asignar `user_id` al crear episodios en API cuando `request.userId` esté presente.
