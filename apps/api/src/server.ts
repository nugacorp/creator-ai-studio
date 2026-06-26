import process from 'node:process';
import { buildApp } from './app.js';

const port = Number(process.env.API_PORT ?? 3000);
const host = process.env.API_HOST ?? '0.0.0.0';

const app = buildApp({ logger: true });

try {
  const address = await app.listen({ port, host });
  app.log.info(`Creator AI Studio API listening on ${address}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
