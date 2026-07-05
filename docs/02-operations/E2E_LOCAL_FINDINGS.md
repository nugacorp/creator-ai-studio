# E2E Local — Hallazgos del flujo completo (crear video paso a paso)

**Fecha:** 2026-07-05
**Entorno:** local (Node 22, ffmpeg 4.4), `NODE_ENV=development`, `ALLOW_MOCKS=true`, proveedores IA/TTS en modo demo.
**Método:** API en :3100 + worker en polling. Se creó un episodio y se ejecutó `run-safe-pipeline` (modo `production-draft`), observando cada paso, más pruebas aisladas de cada endpoint.

## Estado de resolución (2026-07-05, actualización)

**Los 4 hallazgos están corregidos en el código.**

| # | Hallazgo | Estado | Dónde |
|---|----------|--------|-------|
| Bloqueante 1 | Worker manda CT json sin cuerpo → 400 | ✅ Corregido | `workers/production/src/index.ts` (envía `body='{}'`) + parser tolerante en la API |
| Medio 4 | API rechaza cuerpo vacío en JSON | ✅ Corregido | `apps/api/src/app.ts` `buildApp` → `addContentTypeParser` (verificado con Fastify real: cuerpo vacío→200, JSON válido→200, JSON inválido→400) |
| Bloqueante 2 | TTS demo sin audio | ✅ Corregido | `apps/api/src/integrations/tts.ts` → `writeDemoSilentAudio` (audio silencioso con ffmpeg cuando `ALLOW_MOCKS`) |
| Alto 3 | Thumbnail `saved:true` falso | ✅ Corregido | `apps/api/src/media/render.ts` → placeholder ffmpeg cuando la descarga falla en demo |

**Verificación pendiente de green final:** el E2E completo de punta a punta no pudo re-ejecutarse en esta sesión por un fallo de sincronización del sandbox (bash leía los archivos truncados a media instrucción, tanto `src` como `dist`, impidiendo `node` cargar los módulos). Las herramientas de edición sí ven el disco real —por eso los fixes están aplicados y confirmados por inspección + grep en src y dist—, y el mecanismo de Medio 4 se probó de forma aislada con Fastify real. Para el green definitivo, ejecutar en local (ver "Comando E2E" al final).

---

## Resumen ejecutivo (diagnóstico original)

El pipeline **NO llegaba al final**. Se cortaba en el paso **`thumbnail`** (paso 4 de 7) por un bug del worker que afecta a todos los pasos sin cuerpo (thumbnail, render, shorts, publish_package, confirm, archive). Con ese bloqueo resuelto, el segundo bloqueo era el TTS demo, que no generaba archivo de audio y luego impedía el render.

Lo que **sí funciona** de forma aislada: crear episodio, guion (demo), SEO (demo), render de video real con ffmpeg (video reproducible de 5 s, 1920×1080), short 9:16, y el empaquetado `publish-package` con su checklist. El **gating de publicación** funciona correctamente (upload sin `authorize` → 403; `authorize-publish` sin artefactos completos → `publish_package_not_ready`).

## Lista de errores priorizada

### 🔴 BLOQUEANTE 1 — El worker envía `Content-Type: application/json` en POST sin cuerpo → API responde 400
- **Síntoma:** el job `pipeline` falla en el paso `thumbnail` con `error: "FastifyError"`. En el log de la API: `FST_ERR_CTP_EMPTY_JSON_BODY: Body cannot be empty when content-type is set to 'application/json'`.
- **Causa raíz:** `workers/production/src/index.ts` → `apiHeaders()` fija `Content-Type: application/json` en **todas** las peticiones. Fastify rechaza (400) cualquier POST con ese header y cuerpo vacío.
- **Endpoints afectados (todos POST sin cuerpo):** `/episodes/:id/thumbnail`, `/render`, `/shorts`, `/publish-package`, `/confirm-publish`, `/archive`.
- **Impacto:** ningún pipeline puede pasar del paso `tts`. Es la causa #1 de que el flujo no termine.
- **Fix propuesto:** que el worker solo añada `Content-Type: application/json` cuando hay `body`; alternativamente, registrar en la API un content-type parser que tolere cuerpo vacío en JSON. Preferible arreglar el worker (más limpio) **y** endurecer la API para tolerar cuerpos vacíos (defensa en profundidad).
- **Verificación:** `POST /render` con header `Content-Type: application/json` y sin cuerpo → **400**; el mismo POST sin ese header → **200**.

### 🔴 BLOQUEANTE 2 — TTS demo no genera archivo de audio → el render posterior queda sin narración
- **Síntoma:** `POST /integrations/elevenlabs/tts` en demo devuelve `{"audioUrl":"","isDemo":true}` con HTTP 200; no se crea ningún archivo en `05-audio/`. Como el paso reporta éxito, el pipeline avanza, pero el render luego falla con "Genera la narración primero".
- **Causa raíz:** en modo demo no hay proveedor TTS real. El paso `tts` del worker no distingue "demo sin audio" de "audio generado".
- **Impacto:** en demo (y en cualquier entorno sin ElevenLabs/Piper) el pipeline no puede renderizar video con voz.
- **Fix propuesto:** (a) que el paso `tts` del worker falle explícitamente si `isDemo`/`audioUrl` vacío cuando el modo no permite mocks; (b) para pruebas locales sin claves, permitir un TTS de marcador (tono/silencio con duración proporcional al texto) solo cuando `ALLOW_MOCKS=true`, de modo que el flujo E2E se pueda validar sin claves reales. Decisión de producto: en producción esto se resuelve con la FASE 2 (ElevenLabs real).
- **Nota:** este hallazgo es esperado en demo, pero hoy queda **silencioso** — conviene que sea visible.

### 🟠 ALTO 3 — `POST /episodes/:id/thumbnail` responde `saved:true` aunque la imagen no se guardó
- **Síntoma:** el endpoint devuelve `{"imageUrl":"https://…","saved":true}` pero `07-thumbnail/` solo contiene `.gitkeep` (0 bytes). El checklist de publish-package marca `thumbnail: false`, contradiciendo el `saved:true`.
- **Causa raíz:** en `app.ts`, la ruta de thumbnail ignora el valor de retorno de `saveThumbnailToDisk()` (que devuelve `null` si la descarga falla) y siempre responde `saved: true`.
- **Causa secundaria:** el proveedor de imagen **demo** devuelve una URL externa de Unsplash; guardarla exige descargarla por red. En este entorno sandbox Unsplash es inalcanzable (HTTP 000), así que la descarga falla. Con Gemini real (que devuelve `data:` base64) el guardado sí funcionaría offline.
- **Impacto:** correctitud/observabilidad — el sistema afirma que guardó algo que no existe. Rompe la confianza del checklist.
- **Fix propuesto:** devolver `saved: Boolean(savedPath)` y, si falla, un mensaje claro; además considerar un thumbnail demo local (generado con ffmpeg, como ya se hace con el slide placeholder) cuando `ALLOW_MOCKS=true`.

### 🟡 MEDIO 4 — Robustez de content-type en la API (defensa en profundidad)
- **Contexto:** relacionado con el Bloqueante 1. Aunque se arregle el worker, cualquier cliente (curl, otro servicio) que mande `Content-Type: application/json` sin cuerpo recibirá 400 en endpoints que no necesitan cuerpo.
- **Fix propuesto:** registrar en Fastify un parser JSON que trate cuerpo vacío como `{}` (`addContentTypeParser`), para que los POST de "acción" sin payload funcionen siempre.
- **Impacto:** evita una clase entera de errores 400 confusos.

## Lo que quedó verificado como correcto ✅

- Crear episodio (`POST /episodes`) y estructura de carpetas `00-control … 12-review`.
- Guion demo (`/ai/generate-script`) y SEO demo (`/gemini/seo`) devuelven contenido bien formado.
- Render real con ffmpeg: `06-video/episode.mp4` reproducible (5.03 s, con audio inyectado). Rápido (<1 s en este material).
- Short 9:16: `09-shorts/short.mp4` generado.
- `publish-package`: escribe `10-publish/metadata.json` (privacidad `private` por defecto) y `checklist.json` con el estado real de cada artefacto.
- Gating de publicación (FASE 3): `POST /integrations/youtube/upload` sin `authorize:true` → **403 publish_not_authorized**; `authorize-publish` con artefactos incompletos → **400 publish_package_not_ready** devolviendo el checklist. Correcto.
- Health expone `ffmpegAvailable`, `metadataSource`, `mocksAllowed`.

## Orden de corrección sugerido

1. **Bloqueante 1** (worker content-type) — desbloquea el pipeline entero. Bajo esfuerzo.
2. **Medio 4** (parser API tolerante) — refuerza lo anterior. Bajo esfuerzo.
3. **Bloqueante 2** (TTS demo/real) — necesario para E2E con audio; se cruza con FASE 2.
4. **Alto 3** (thumbnail `saved` veraz) — correctitud; bajo esfuerzo.

Tras 1, 2 y 4, un pipeline `production-draft` debería completar de principio a fin en local con mocks (guion → SEO → TTS marcador → thumbnail demo → render → short → publish-package = ready).

## Comando E2E (green final en local)

```bash
npm ci && npm run build

# Terminal 1 — API
NODE_ENV=development ALLOW_MOCKS=true AI_ALLOW_DEMO_FALLBACK=true \
  LOCAL_STORAGE_PATH=/tmp/cas/episodes \
  CAS_SECRETS_KEY=local-e2e-master-key-0123456789 \
  API_PORT=3000 node apps/api/dist/server.js

# Terminal 2 — Worker
API_BASE_URL=http://localhost:3000/api WORKER_POLL_INTERVAL_MS=1000 \
  LOCAL_STORAGE_PATH=/tmp/cas/episodes node workers/production/dist/index.js

# Terminal 3 — disparar el flujo
EP=$(curl -s -X POST localhost:3000/api/episodes -H 'Content-Type: application/json' -d '{"title":"E2E"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST localhost:3000/api/episodes/$EP/run-safe-pipeline -H 'Content-Type: application/json' -d '{}'
# Poll GET /api/jobs/<jobId> hasta status=completed y revisar los artefactos en 02..10.
```

Esperado: el job `pipeline` llega a `completed` con los 7 pasos, y `10-publish/checklist.json` marca `ready: true`.

