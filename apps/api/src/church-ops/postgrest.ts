import process from 'node:process';
import { getSupabaseConfig } from '../db/supabase.js';

/**
 * Thin PostgREST client for the church platform.
 *
 * Two callers, two identities:
 *  - `userClient(token)` sends the caller's JWT, so every statement runs under
 *    row-level security. This is what HTTP routes use.
 *  - `serviceClient()` sends the service_role key and bypasses RLS. Reserved
 *    for background work with no user in scope (the publishing worker).
 */

export class ChurchDbError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.name = 'ChurchDbError';
    this.status = status;
    this.details = details;
  }
}

export class ChurchDbNotConfiguredError extends ChurchDbError {
  constructor() {
    super(
      503,
      'Supabase no está configurado. Define SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.',
    );
    this.name = 'ChurchDbNotConfiguredError';
  }
}

function anonKey(): string | null {
  return process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? null;
}

export function isChurchDbConfigured(): boolean {
  return Boolean(getSupabaseConfig() && anonKey());
}

export interface QueryOptions {
  /** PostgREST query params, e.g. `{ select: 'id,name', order: 'created_at.desc' }`. */
  params?: Record<string, string | undefined>;
  /** `return=representation` by default on writes so callers get the row back. */
  prefer?: string;
  signal?: AbortSignal;
}

interface PostgrestErrorBody {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

/** Map Postgres/PostgREST failures onto HTTP statuses the UI can act on. */
function statusForPostgrestError(status: number, body: PostgrestErrorBody): number {
  // 42501 = insufficient_privilege; PostgREST returns 401/403 for RLS denials.
  if (body.code === '42501' || status === 401 || status === 403) return 403;
  if (body.code === '23505') return 409; // unique_violation
  if (body.code === '23503') return 409; // foreign_key_violation
  if (body.code === '23514') return 400; // check_violation
  if (body.code === 'PGRST116') return 404; // no rows for single-object request
  return status;
}

class ChurchDbClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly authToken: string;

  constructor(baseUrl: string, apiKey: string, authToken: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.authToken = authToken;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  private url(table: string, params?: Record<string, string | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined) search.set(key, value);
    }
    const qs = search.toString();
    return `${this.baseUrl}/rest/v1/${table}${qs ? `?${qs}` : ''}`;
  }

  private async request<T>(
    url: string,
    init: RequestInit & { headers: Record<string, string> },
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      throw new ChurchDbError(
        502,
        'No se pudo contactar la base de datos',
        error instanceof Error ? error.message : undefined,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      const body = (payload ?? {}) as PostgrestErrorBody;
      throw new ChurchDbError(
        statusForPostgrestError(response.status, body),
        body.message ?? `Error de base de datos (${response.status})`,
        body.details ?? body.hint,
      );
    }

    return payload as T;
  }

  async select<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
    return this.request<T[]>(this.url(table, options.params), {
      method: 'GET',
      headers: this.headers(),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  }

  async selectOne<T>(table: string, options: QueryOptions = {}): Promise<T | null> {
    const rows = await this.select<T>(table, {
      ...options,
      params: { ...options.params, limit: '1' },
    });
    return rows[0] ?? null;
  }

  async insert<T>(table: string, values: unknown, options: QueryOptions = {}): Promise<T[]> {
    return this.request<T[]>(this.url(table, options.params), {
      method: 'POST',
      headers: this.headers({ Prefer: options.prefer ?? 'return=representation' }),
      body: JSON.stringify(values),
    });
  }

  async insertOne<T>(table: string, values: unknown, options: QueryOptions = {}): Promise<T> {
    const rows = await this.insert<T>(table, values, options);
    const row = rows[0];
    if (!row) {
      throw new ChurchDbError(500, 'La inserción no devolvió ninguna fila');
    }
    return row;
  }

  async update<T>(
    table: string,
    values: unknown,
    params: Record<string, string | undefined>,
    options: QueryOptions = {},
  ): Promise<T[]> {
    return this.request<T[]>(this.url(table, params), {
      method: 'PATCH',
      headers: this.headers({ Prefer: options.prefer ?? 'return=representation' }),
      body: JSON.stringify(values),
    });
  }

  async delete(table: string, params: Record<string, string | undefined>): Promise<void> {
    await this.request<unknown>(this.url(table, params), {
      method: 'DELETE',
      headers: this.headers({ Prefer: 'return=minimal' }),
    });
  }

  /** Call a Postgres function (`/rest/v1/rpc/<name>`). */
  async rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>(`${this.baseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(args),
    });
  }
}

export type { ChurchDbClient };

/** Client bound to the caller's identity. Every query is subject to RLS. */
export function userClient(accessToken: string): ChurchDbClient {
  const config = getSupabaseConfig();
  const key = anonKey();
  if (!config || !key) throw new ChurchDbNotConfiguredError();
  return new ChurchDbClient(config.url, key, accessToken);
}

/** Client with service_role. Bypasses RLS — background jobs only. */
export function serviceClient(): ChurchDbClient {
  const config = getSupabaseConfig();
  if (!config) throw new ChurchDbNotConfiguredError();
  return new ChurchDbClient(config.url, config.serviceRoleKey, config.serviceRoleKey);
}

/** PostgREST `or=` filter helper: `or(a.eq.1,b.eq.2)`. */
export function orFilter(...conditions: string[]): string {
  return `(${conditions.join(',')})`;
}
