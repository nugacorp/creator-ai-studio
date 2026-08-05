## Document ID

PLAN_TECNICO_PLATAFORMA_IGLESIA

## Title

Plan Técnico Ejecutable — Plataforma del Equipo Digital de Iglesia

## Version

1.0.0

## Status

Active — Reemplaza el rumbo de canal YouTube por plataforma de equipo

## Author

Claude (Cowork) + Ramiro

## Created

2026-08-03

## Last Updated

2026-08-03

## Purpose

Traducir el cambio de rumbo (de "canal bíblico automatizado en YouTube" a "plataforma de trabajo del equipo digital de la iglesia") en un plan de desarrollo ejecutable, mapeado línea por línea contra el código que ya existe en este repositorio.

Este documento **no repite** la visión estratégica de [PLAN_IGLESIA_EQUIPO_DIGITAL.md](PLAN_IGLESIA_EQUIPO_DIGITAL.md). Ese documento dice *qué* se quiere. Este dice *qué se toca, en qué orden, y cómo se sabe que está terminado*.

---

## 1. Restricciones que definen el plan

Estas restricciones no son negociables y filtran todo lo demás:

| Restricción | Valor real | Consecuencia de diseño |
|---|---|---|
| Desarrollo | **1 persona** (Ramiro + IA) | Nada de microservicios nuevos. Se extiende el monorepo actual. Máximo un módulo grande a la vez. |
| Operación | **5 personas** (Ramiro + 4) | Los permisos deben ser simples: 5 roles, no 8. Sin flujos de aprobación de 3 niveles. |
| Transmisión | OBS ya existe en la iglesia | **Cero ingesta RTMP propia.** La plataforma controla y observa OBS; no transmite. |
| Legado | Pipeline YouTube funcionando en staging | Se **reencuadra**, no se tira. Los 14 agentes pasan de obligatorios a opcionales. |
| Infra | 1 VPS (217.76.56.66) + Redis + Supabase | El DAM usa el volumen `/data` + rclone a Drive. Sin S3 nuevo. |

### Principio rector

> Cada función nueva debe ser usable por un voluntario que entró hace una semana, sin leer un manual.

Si una función requiere explicación, o se simplifica o no entra en el MVP.

---

## 2. Inventario: qué existe hoy y qué pasa con eso

Auditoría real del código en `main` @ `d107fba`.

### 2.1 Se reutiliza tal cual (0 esfuerzo)

| Componente | Ubicación | Nuevo rol en la plataforma de iglesia |
|---|---|---|
| Auth Supabase JWT | `apps/api/src/auth/` | Login del equipo. Ya funciona. |
| Cola de jobs + worker | `apps/api/src/jobs/`, `workers/production/` | Render, transcodificación y publicación asíncrona. La columna vertebral del sistema. |
| Storage de episodios (14 etapas) | `apps/api/src/storage/index.ts` | Se convierte en **storage de producciones**. Las carpetas `00-control` … `12-review` siguen sirviendo. |
| YouTube OAuth + upload | `apps/api/src/integrations/youtube.ts`, `oauth/google.ts` | Publicación a YouTube. Ya resuelto, incluyendo persistencia de tokens en `/data`. |
| Archive rclone → Drive | `apps/api/src/archive/` | Política de retención del DAM. Sermones viejos salen del VPS automáticamente. |
| Router de IA multi-proveedor | `apps/api/src/ai/router.ts` | Copiloto editorial: títulos, descripciones, hashtags, resúmenes. |
| Subtítulos + TTS | `apps/api/src/media/subtitles.ts`, `integrations/tts.ts` | Subtitulado de sermones y clips. Alto valor inmediato. |
| Calendario + post dominical | `apps/api/src/calendar/` | Base del calendario editorial. Ya automatiza el post de servicio del domingo. |

### 2.2 Existe pero está incompleto (se extiende)

| Componente | Estado real | Qué le falta |
|---|---|---|
| **DAM** (`digital-assets/store.ts`) | Solo metadatos en un JSON plano. **No almacena archivos.** | Subida real de archivos, versionado, miniaturas, búsqueda. |
| **Equipos** (`team/store.ts`) | Roles `owner \| editor \| viewer` persistidos. | ⚠️ **Ninguna ruta de la API verifica el rol.** Cualquier usuario autenticado puede borrar cualquier cosa. Ver §4. |
| **Multicanal** (`channels/`) | Solo canales de YouTube. | Debe representar *destinos de publicación* de cualquier plataforma. |
| **Analytics** (`app.ts:487`) | Métricas de YouTube. | Métricas por ministerio y por plataforma. |
| **Automatización** (`AutomationView.tsx`) | Maqueta. No conectada al backend. | Motor real de reglas, o se elimina de la navegación. |

### 2.3 Se reencuadra (mismo código, otro significado)

| Hoy | Mañana |
|---|---|
| "Episodio" del canal bíblico | **Producción**: sermón, clip, reel, anuncio, testimonio |
| 14 agentes que corren en cadena obligatoria | Asistentes que el equipo invoca **cuando quiere** (botón, no automatismo) |
| "Modo Producción" | Panel de cola de trabajos del equipo |
| "Estudio de agentes" | Se oculta para roles no técnicos |

### 2.4 Se elimina o se congela

| Elemento | Decisión | Razón |
|---|---|---|
| `AutomationView` como está | **Ocultar del sidebar** hasta Fase 5 | Maqueta que promete lo que no existe. Confunde a voluntarios. |
| Ideación automática de temas bíblicos | Congelar | La iglesia ya sabe qué va a predicar. No necesita que la IA invente temas. |
| Generación de guion completo por IA | Degradar a opcional | Un sermón no se escribe con IA. Los clips promocionales sí. |
| Narración TTS como paso obligatorio | Degradar a opcional | La voz es la del pastor, no sintética. TTS queda para anuncios. |

---

## 3. Arquitectura objetivo

```
                    ┌──────────────────────────────────┐
                    │  Web (React) — 5 espacios         │
                    │  Hoy · Biblioteca · Producciones  │
                    │  En Vivo · Calendario             │
                    └────────────┬─────────────────────┘
                                 │ /api  (Supabase JWT + rol)
                    ┌────────────▼─────────────────────┐
                    │  API Fastify                      │
                    │  ┌──────────┬──────────────────┐  │
                    │  │ NUEVO    │ EXISTENTE        │  │
                    │  │ assets/  │ storage/         │  │
                    │  │ live/    │ jobs/  agents/   │  │
                    │  │ publish/ │ ai/    calendar/ │  │
                    │  │ rbac/    │ archive/ team/   │  │
                    │  └──────────┴──────────────────┘  │
                    └───┬──────────────┬───────────┬────┘
                        │              │           │
                 ┌──────▼─────┐ ┌──────▼─────┐ ┌──▼────────────┐
                 │ Worker     │ │ Conectores │ │ OBS WebSocket │
                 │ (Redis)    │ │ YT/FB/IG   │ │ (LAN iglesia) │
                 │ render     │ │ TikTok     │ │ obs-websocket │
                 │ transcode  │ │            │ │ v5            │
                 └──────┬─────┘ └────────────┘ └───────────────┘
                        │
                 ┌──────▼──────────────────────┐
                 │ /data (VPS) → rclone → Drive │
                 └─────────────────────────────┘
```

### Decisiones de arquitectura

**AD-1 — El DAM guarda archivos en `/data/assets/`, no en Supabase Storage.**
Ya existe el volumen, ya existe rclone, ya existe la política de archivado. Agregar Supabase Storage duplicaría la lógica de lifecycle. Costo: el DAM está atado al VPS. Aceptable con 5 usuarios.

**AD-2 — OBS se controla vía `obs-websocket` v5, no por ingesta RTMP.**
La librería [`obs-websocket-js` v5.0.8](https://www.npmjs.com/package/obs-websocket-js) habla el protocolo v5, incluido en OBS 28+. La API se conecta al OBS de la iglesia y puede: leer estado del stream, cambiar de escena, iniciar/detener transmisión y grabación, leer estadísticas de señal. Coste de infra: **cero**.
Limitación honesta: OBS está en la LAN de la iglesia, el API en un VPS. Requiere túnel (Tailscale/Cloudflare Tunnel) o un agente ligero en la PC de transmisión. Ver §7.

**AD-3 — Conectores de publicación desacoplados, con degradación explícita.**
Cada plataforma es un módulo con la misma interfaz. YouTube y Facebook publican de verdad. Instagram y TikTok, en la práctica, no: TikTok exige revisión manual de la app que tarda semanas y su flujo recomendado es *Upload to Inbox* (el video llega al inbox del creador, que publica a mano); Instagram exige cuenta Business ligada a una Página y App Review, con tope de 25 publicaciones por cuenta cada 24 h. Por lo tanto el conector de IG/TikTok en el MVP genera **el paquete listo para publicar** (video correcto + copy + hashtags) y notifica al social media manager. Es honesto y funciona desde el día uno.

**AD-4 — Los permisos se aplican en la API, no en la UI.**
Ocultar un botón no es seguridad. El chequeo va en un hook de Fastify antes del handler.

---

## 4. 🔴 Deuda de seguridad crítica (bloquea todo lo demás)

El sistema hoy tiene **autenticación pero no autorización**. `registerAuthHook` valida el JWT y pasa. Ninguna ruta consulta el rol del usuario. Con 1 solo usuario (tú) era irrelevante. Con 5 voluntarios es un problema real: cualquiera puede borrar producciones, publicar en YouTube o cambiar credenciales.

**Esto se arregla primero.** No hay Fase 1 sin esto.

### Modelo de roles propuesto (5, no 8)

| Rol | Puede | No puede |
|---|---|---|
| `admin` | Todo, incluidas credenciales y borrado | — |
| `lider` | Aprobar y publicar; ver todo | Tocar credenciales, borrar assets |
| `productor` | Crear/editar producciones, subir assets, lanzar render | Publicar, aprobar |
| `disenador` | Subir/editar imágenes y miniaturas | Publicar, editar guiones |
| `voluntario` | Ver, comentar, subir material crudo | Editar, publicar, borrar |

Migración desde los roles actuales: `owner`→`admin`, `editor`→`productor`, `viewer`→`voluntario`.

### Matriz de permisos (fuente de verdad, se codifica tal cual)

| Acción | admin | lider | productor | disenador | voluntario |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver biblioteca | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subir asset | ✅ | ✅ | ✅ | ✅ | ✅ |
| Borrar asset | ✅ | — | — | — | — |
| Crear producción | ✅ | ✅ | ✅ | — | — |
| Editar guion | ✅ | ✅ | ✅ | — | — |
| Subir miniatura/arte | ✅ | ✅ | ✅ | ✅ | — |
| Lanzar render | ✅ | ✅ | ✅ | — | — |
| Aprobar | ✅ | ✅ | — | — | — |
| Publicar | ✅ | ✅ | — | — | — |
| Controlar OBS | ✅ | ✅ | ✅ | — | — |
| Gestionar equipo | ✅ | — | — | — | — |
| Ver/editar credenciales | ✅ | — | — | — | — |
| Comentar | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. Modelo de datos nuevo

Se agregan 6 entidades. Persistencia: JSON en `/data` (consistente con lo existente), con sync a Supabase donde ya hay tabla.

```ts
// packages/shared/src/church.ts  (nuevo)

type ChurchRole = 'admin' | 'lider' | 'productor' | 'disenador' | 'voluntario';

interface Asset {
  id: string;
  name: string;
  kind: 'video' | 'audio' | 'image' | 'document' | 'template';
  storagePath: string;        // /data/assets/<yyyy>/<mm>/<id>/<version>
  mimeType: string;
  sizeBytes: number;
  thumbnailPath?: string;
  versions: AssetVersion[];   // versionado explícito
  ministry: string;           // 'jovenes' | 'alabanza' | 'general' | ...
  series?: string;            // "Serie: Romanos"
  preacher?: string;
  bibleRef?: string;          // "Juan 3:16"
  tags: string[];
  serviceDate?: string;
  uploadedBy: string;
  createdAt: string;
  archivedAt?: string;        // set cuando rclone lo mueve a Drive
  driveId?: string;
}

interface Production {          // reemplaza conceptualmente a "Episode"
  id: string;
  title: string;
  format: 'sermon' | 'clip' | 'reel' | 'anuncio' | 'testimonio' | 'devocional';
  ministry: string;
  serviceDate?: string;
  status: 'idea' | 'grabacion' | 'edicion' | 'revision' | 'aprobado' | 'publicado';
  assignedTo: string[];
  sourceAssetIds: string[];
  outputs: RenderOutput[];      // uno por preset/plataforma
  approvals: Approval[];
  legacyEpisodeId?: string;     // puente con el storage actual
}

interface LiveEvent {
  id: string;
  title: string;               // "Culto Dominical"
  scheduledAt: string;
  platforms: PublishTargetId[];
  crew: { userId: string; role: string }[];   // switcher, audio, cámara, chat
  checklist: ChecklistItem[];
  obsProfile?: string;
  status: 'planeado' | 'preflight' | 'en_vivo' | 'finalizado';
  incidents: Incident[];
  recordingAssetId?: string;   // la grabación entra al DAM automáticamente
}

interface PublishTarget {      // generaliza el "channel" actual de YouTube
  id: string;
  platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'x';
  displayName: string;
  mode: 'auto' | 'assisted';   // assisted = genera paquete, publica un humano
  credentialsRef?: string;
  renderPreset: string;
}

interface Approval {
  id: string;
  productionId: string;
  requestedBy: string;
  decidedBy?: string;
  decision?: 'aprobado' | 'cambios';
  comment?: string;
  decidedAt?: string;
}

interface CalendarEntry {
  id: string;
  productionId?: string;
  liveEventId?: string;
  targetId: string;
  scheduledFor: string;        // timezone de la iglesia, no UTC en la UI
  status: 'programado' | 'publicando' | 'publicado' | 'fallido';
  attempts: number;
}
```

---

## 6. Work orders — orden de ejecución

Cada work order tiene criterio de aceptación verificable. **No se avanza sin cumplirlo.**

Estimaciones asumen 1 desarrollador con asistencia de IA, ~10–15 h/semana.

### WO-0 · Autorización por rol 🔴 · 1 semana

*Bloquea todo. Es lo primero.*

- `packages/shared/src/church.ts`: tipo `ChurchRole` + matriz de permisos como constante.
- `apps/api/src/auth/rbac.ts`: `requirePermission('production.publish')` como preHandler de Fastify.
- Aplicar el preHandler a **todas** las rutas mutantes de `app.ts`, `team/routes.ts`, `secrets/routes.ts`, `jobs/routes.ts`.
- Migración de roles existentes en `team.json`.
- Web: `useCan(permiso)` para ocultar UI (defensa secundaria, no primaria).

**Aceptación:** un usuario con rol `voluntario` recibe `403` al intentar `DELETE /api/episodes/:id` y al intentar `POST /api/integrations/youtube/upload`. Test automatizado que cubre las 13 filas de la matriz de §4.

---

### WO-1 · DAM real con archivos y versiones · 2–3 semanas

*El módulo de mayor valor. Es lo que el equipo va a usar todos los días.*

- Subida multipart con streaming a `/data/assets/<yyyy>/<mm>/<id>/v<n>/`. Límite configurable (sugerido 5 GB por archivo para sermones en bruto).
- Extender `digital-assets/store.ts` al modelo `Asset` de §5 (hoy solo guarda metadatos sin archivo).
- Generación de miniaturas y `poster` vía FFmpeg **en el worker**, no en la API.
- Versionado: subir de nuevo el mismo asset crea `v2`, `v1` queda accesible.
- Búsqueda por ministerio, serie, predicador, fecha, texto y tag.
- Reescribir `LibraryView.tsx`: grilla con miniaturas, filtros laterales, subida por arrastre, vista previa inline.
- Enganchar `archive/policy.ts` a los assets: los que superen X días sin uso van a Drive y quedan como enlace.

**Aceptación:** un voluntario arrastra un MP4 de 2 GB desde el navegador, ve la miniatura en menos de 60 s, le pone predicador y cita bíblica, y otro miembro lo encuentra buscando "Romanos".

---

### WO-2 · Producciones: pipeline humano primero · 2–3 semanas

- Renombrar el dominio de `Episode` → `Production` con `legacyEpisodeId` como puente (sin romper el storage existente).
- Estados nuevos: `idea → grabacion → edicion → revision → aprobado → publicado`.
- Plantillas por formato: cada formato precarga etapas y presets distintos (un `reel` no necesita etapa de investigación).
- Asignación de responsables + comentarios por producción.
- Aprobaciones: `lider` aprueba o pide cambios, con comentario. Nadie publica sin aprobación.
- Presets de render por plataforma en el worker: 16:9 1080p (YouTube/FB), 9:16 1080×1920 (reels/shorts/TikTok), 1:1 (feed IG).
- Los 14 agentes pasan a ser botones opcionales por etapa ("Sugerir título", "Generar descripción SEO", "Proponer cortes"), nunca ejecución en cadena.

**Aceptación:** el equipo lleva un sermón grabado desde `grabacion` hasta `aprobado` con dos personas distintas, y el productor no puede saltarse la aprobación del líder.

---

### WO-3 · Calendario editorial y publicación · 2 semanas

- `CalendarEntry` + vista mensual/semanal en `CalendarView.tsx`, en timezone de la iglesia.
- Programar una producción a uno o varios destinos desde una sola acción.
- Publicación real a **YouTube** (ya existe) y **Facebook Pages** (nuevo conector).
- Modo `assisted` para Instagram y TikTok: genera el archivo con el preset correcto + copy + hashtags, lo deja descargable y notifica al responsable. Sin promesas falsas.
- Reintentos con backoff en el worker + alerta cuando una publicación falla.
- Reutilización: desde un sermón publicado, botón "Crear clip" que abre una producción `reel` con el asset fuente ya vinculado.

**Aceptación:** se programa un sermón el jueves para publicarse el domingo 10:00; sale solo en YouTube y Facebook, y el social media manager recibe el paquete de IG listo.

---

### WO-4 · Transmisión en vivo (coordinación + control de OBS) · 2–3 semanas

*Alcance acotado deliberadamente. Ver §7 para la decisión de conectividad.*

- `LiveEvent` + planificador: fecha, plataformas, equipo asignado por puesto.
- Checklist de preflight configurable, con quién marcó cada ítem y a qué hora.
- Control de OBS vía `obs-websocket-js` v5: estado del stream, escena activa, cambio de escena, start/stop de transmisión y grabación, bitrate, frames perdidos.
- Panel en vivo: semáforo de salud de señal, cronómetro, escena actual.
- Post-evento: registro de incidentes + la grabación de OBS entra al DAM como asset.

**Aceptación:** 30 minutos antes del culto el equipo abre el evento, completa el checklist, ve OBS conectado, y desde la plataforma cambia de escena "Cámara 1" a "Alabanza".

**Salida elegante:** si la conectividad con OBS resulta inviable en el sitio (§7), este WO se recorta a planificador + checklist + registro post-evento, y sigue aportando valor real.

---

### WO-5 · Analítica e imágenes · 2 semanas

- Dashboard por ministerio y plataforma: alcance, reproducciones, retención, interacciones.
- Indicadores de proceso: tiempo idea→publicación, cumplimiento del calendario.
- Kit de marca centralizado (logos, tipografías, paleta) en el DAM.
- Redimensionado inteligente de artes por canal (worker + `sharp`).
- Plantillas de arte reutilizables — se apoya en lo que ya hace `calendar/sunday-post-image`.

**Aceptación:** el líder ve en una pantalla cuánto contenido publicó cada ministerio el mes pasado y cuánto tardó en promedio desde idea hasta publicación.

---

### Cronograma

| Semana | Work order |
|---|---|
| 1 | WO-0 Autorización 🔴 |
| 2–4 | WO-1 DAM |
| 5–7 | WO-2 Producciones |
| 8–9 | WO-3 Calendario y publicación |
| 10–12 | WO-4 Live + OBS |
| 13–14 | WO-5 Analítica e imágenes |

**Piloto con el equipo real a partir de la semana 7**, no al final. Dos personas usando WO-0 + WO-1 + WO-2 en un servicio real vale más que tres módulos más terminados en soledad.

---

## 7. La decisión que hay que tomar sobre OBS

OBS corre en la PC de transmisión, dentro de la red de la iglesia. La API corre en un VPS público. `obs-websocket` escucha en un puerto local. Hay tres caminos:

| Opción | Cómo | Esfuerzo | Riesgo |
|---|---|---|---|
| **A. Tailscale** (recomendado) | PC de transmisión y VPS en la misma red privada. La API conecta a `ws://<tailscale-ip>:4455`. | Bajo — instalar un cliente | Depende de que la PC esté encendida y conectada |
| **B. Agente local** | Un script Node en la PC que se conecta *saliente* al API por WebSocket y hace de puente a OBS. | Medio — hay que escribir y mantener el agente | Otra pieza que puede fallar sin que nadie lo note |
| **C. Solo navegador** | El panel en vivo corre en la PC de transmisión y habla con OBS en `localhost`. La API solo guarda el registro. | Muy bajo | El panel solo funciona desde esa PC |

**Recomendación: A, con C como respaldo inmediato.** Tailscale resuelve el problema en una tarde. Si la iglesia no quiere instalar nada, la opción C entrega el 80 % del valor sin infraestructura.

Esta decisión debe tomarse **antes de la semana 10**, no durante.

---

## 8. Reorganización de la navegación

De 13 entradas de sidebar a 6. Menos es más con voluntarios.

| Nuevo espacio | Absorbe |
|---|---|
| **Hoy** | Home + tareas asignadas a mí + próximos eventos |
| **Biblioteca** | Library/DAM + kit de marca |
| **Producciones** | Proyectos + Workspace + Contenido + Modo Producción |
| **En Vivo** | *(nuevo)* |
| **Calendario** | Calendario + Publicaciones + Multicanal |
| **Equipo** | Equipos + Configuración + Agentes *(solo admin)* |

Se retiran del sidebar: `Automatización` (maqueta), `Estudio de agentes` (solo admin), `IA Copilot` (pasa a botón flotante presente en toda la app).

---

## 9. Riesgos reales

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| El equipo no adopta y sigue usando WhatsApp + Drive | **Alta** | Piloto en semana 7. Si el DAM no les ahorra tiempo desde el día uno, hay que rediseñarlo antes de seguir. |
| Un solo desarrollador se queda sin tiempo | Alta | El orden de los WO es también el orden de valor. Parar después de WO-2 deja algo útil y usable. |
| Instagram/TikTok nunca aprueban la app | Media-alta | Ya está previsto: modo `assisted`. No hay dependencia crítica. |
| El VPS se queda sin disco con sermones de 2 GB | Media | rclone + política de retención desde WO-1, no después. Monitorear `system/storage`. |
| OBS inaccesible desde el VPS | Media | §7, opción C como plan B. |
| Rotación de voluntarios | Alta | Manual de una página por rol. UX simple no es estética, es requisito operativo. |

---

## 10. Qué explícitamente NO se construye

Declararlo evita discusiones y trabajo desperdiciado:

- Ingesta ni reenvío RTMP propio.
- Editor de video en el navegador.
- App móvil.
- Motor de automatización con reglas visuales (Fase posterior, si acaso).
- Chat interno (WhatsApp ya funciona para eso).
- Gestión de miembros, donaciones o asistencia — eso es un ChMS, no esta plataforma.
- Generación automática de sermones por IA.

---

## 11. Criterio de éxito a 90 días

No son métricas de vanidad. Si estas tres no se cumplen, el proyecto falló:

1. Los 5 miembros del equipo entran a la plataforma al menos una vez por semana **sin que nadie se los recuerde**.
2. El sermón dominical llega a YouTube y Facebook desde la plataforma, sin pasar por Drive ni WhatsApp.
3. Encontrar un video de hace 6 meses toma **menos de 1 minuto**.

---

## Related Documents

- [PLAN_IGLESIA_EQUIPO_DIGITAL.md](PLAN_IGLESIA_EQUIPO_DIGITAL.md) — visión estratégica
- [PROJECT_STATE.md](../../PROJECT_STATE.md) — estado real del sistema
- [docs/01-architecture/TECH_STACK.md](../01-architecture/TECH_STACK.md)
- [docs/02-operations/RUNBOOK.md](../02-operations/RUNBOOK.md)
- [docs/02-operations/RCLONE_DRIVE.md](../02-operations/RCLONE_DRIVE.md)

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-08-03 | 1.0.0 | Claude + Ramiro | Plan técnico ejecutable mapeado al código real. Hallazgo crítico: roles sin enforcement en la API. |
