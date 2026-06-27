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

| Variable | Dónde | Uso |
|----------|--------|-----|
| `VITE_SUPABASE_URL` | Build web | Cliente Supabase |
| `VITE_SUPABASE_ANON_KEY` | Build web | Cliente Supabase |
| `SUPABASE_JWT_SECRET` | API | Validar JWT (`Project Settings → API → JWT Secret`) |
| `SUPABASE_URL` | API (opcional) | Sync Postgres |
| `SUPABASE_SERVICE_ROLE_KEY` | API (opcional) | Sync Postgres |

Tras definir `VITE_*`, **rebuild** la imagen web. Con `SUPABASE_JWT_SECRET` en la API, todas las rutas `/api/*` (excepto health y OAuth) requieren `Authorization: Bearer <access_token>`.

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

- Sin `VITE_SUPABASE_*`, la web sigue **sin login** (comportamiento actual).
- OAuth Google en Configuración ≠ login Supabase; son flujos distintos.
- Fase 2: asignar `user_id` al crear episodios en API cuando `request.userId` esté presente.
