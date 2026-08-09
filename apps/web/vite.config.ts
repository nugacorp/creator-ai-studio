import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (value.length === 0) return '';

  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }

  return value.replace(/\s+#.*$/, '').trim();
}

function loadViteSupabaseEnv(): void {
  const filePath = path.join(workspaceRoot, '.env.supabase.local');
  if (!existsSync(filePath)) return;

  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?(VITE_[A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!key || rawValue === undefined || process.env[key] !== undefined) continue;
    process.env[key] = parseEnvValue(rawValue);
  }
}

loadViteSupabaseEnv();

export default defineConfig({
  envDir: workspaceRoot,
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
