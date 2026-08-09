import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RUNTIME_ENV_FILES = ['.env', '.env.local', '.env.supabase.local'] as const;

function hasWorkspacePackageJson(dir: string): boolean {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!existsSync(packageJsonPath)) return false;

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      workspaces?: unknown;
    };
    return Array.isArray(parsed.workspaces);
  } catch {
    return false;
  }
}

function findWorkspaceRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    if (hasWorkspacePackageJson(current)) return current;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (value.length === 0) return '';

  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    const inner = value.slice(1, -1);
    if (quote === "'") return inner;

    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  return value.replace(/\s+#.*$/, '').trim();
}

function applyEnvFile(filePath: string, lockedKeys: Set<string>): void {
  const text = readFileSync(filePath, 'utf8');

  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!key || rawValue === undefined || lockedKeys.has(key)) continue;
    process.env[key] = parseEnvValue(rawValue);
  }
}

export function loadRuntimeEnv(options: { rootDir?: string; files?: readonly string[] } = {}): string[] {
  const rootDir = options.rootDir ?? findWorkspaceRoot(process.cwd()) ?? process.cwd();
  const lockedKeys = new Set(Object.keys(process.env));
  const loaded: string[] = [];

  for (const file of options.files ?? RUNTIME_ENV_FILES) {
    const filePath = path.join(rootDir, file);
    if (!existsSync(filePath)) continue;

    applyEnvFile(filePath, lockedKeys);
    loaded.push(filePath);
  }

  return loaded;
}
