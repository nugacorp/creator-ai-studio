import process from 'node:process';
import { buildApp } from './app.js';

const port = Number(process.env.API_PORT ?? 3000);
const host = process.env.API_HOST ?? '0.0.0.0';

const app = buildApp({ logger: true });

// Graceful shutdown: let in-flight requests finish before the container stops
// (Coolify/Docker sends SIGTERM on redeploy).
let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`Received ${signal}, shutting down gracefully`);
    void app
      .close()
      .then(() => process.exit(0))
      .catch((error) => {
        app.log.error(error);
        process.exit(1);
      });
  });
}

try {
  const address = await app.listen({ port, host });
  app.log.info(`Creator AI Studio API listening on ${address}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
