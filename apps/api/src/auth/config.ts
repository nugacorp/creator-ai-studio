import process from 'node:process';
import { isSupabaseAuthConfigured } from './supabase-jwt.js';

export interface AuthConfig {
  authRequired: boolean;
  apiKeyAuth: boolean;
  supabaseAuth: boolean;
}

export function getAuthConfig(): AuthConfig {
  const apiKey = process.env.CAS_API_KEY;
  const supabaseAuth = isSupabaseAuthConfigured();
  return {
    authRequired: Boolean(apiKey || supabaseAuth),
    apiKeyAuth: Boolean(apiKey),
    supabaseAuth,
  };
}
