# rclone — OAuth interactivo en VPS

## Estado actual

El módulo de archivo a Google Drive (`apps/api/src/archive/drive.ts`) está implementado y referenciado por el workflow, pero **el remote OAuth de rclone aún no está configurado en el VPS**. La variable `RCLONE_REMOTE` existe; sin embargo, el token de refresh nunca se autorizó de forma interactiva.

## Pasos a ejecutar manualmente (VPS)

### 1. Conectarse al VPS

```bash
ssh creator@217.76.56.66
```

### 2. Instalar rclone (si no está)

```bash
curl https://rclone.org/install.sh | sudo bash
```

### 3. Crear el remote de Google Drive

```bash
rclone config

# n) New remote
# name> gdrive-cas
# Storage> drive (Google Drive)
# client_id> <oauth_client_id>     # opcional, se puede dejar en blanco
# client_secret> <oauth_client_secret>
# scope> 1 (Full access)
# service_account_file> (vacío)
# Edit advanced config?> n
# Use web browser to automatically authenticate?
#   En VPS headless: NO → usar SSH tunnel:
#   En local primero: ssh -L 53682:127.0.0.1:53682 creator@217.76.56.66
#   luego rclone config en la sesión SSH con browser local.
# Confirmar remote y salir (q).
```

### 4. Verificar acceso

```bash
rclone lsd gdrive-cas:
# esperado: lista de carpetas en Drive
```

### 5. Configurar variable de entorno

En Coolify → servicio `api`:

- `RCLONE_REMOTE=gdrive-cas:creator-ai-studio`
- `RCLONE_CONFIG=/config/rclone/rclone.conf`

El volumen `/config/rclone` ya está montado en `deploy/docker-compose.staging.yml` y `deploy/docker-compose.production.yml`.

### 6. Probar el flujo de archivo

```bash
# Login al panel, archivar manualmente un episodio viejo.
# Verificar en Drive:
rclone ls gdrive-cas:creator-ai-studio --max-depth 2
```

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Failed to create file system for "gdrive-cas:"` | Remote no configurado | Repetir paso 3 |
| `403 Access denied` | Token revocado | `rclone config reconnect gdrive-cas:` |
| `quotaExceeded` | Drive lleno | Liberar espacio o actualizar plan |

## Bloqueador

Requiere acceso SSH al VPS y autorización OAuth con la cuenta de Google del equipo. No automatizable desde el worktree.
