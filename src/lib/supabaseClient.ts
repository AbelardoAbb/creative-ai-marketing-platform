/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Client-side Supabase client initialization.
 *
 * CRITICAL SECURITY DIRECTIVE:
 * - Uses strictly the Public/Anonymous key (SUPABASE_ANON_KEY).
 * - SUPABASE_SERVICE_ROLE_KEY is NEVER exposed here or in any client code.
 * - Sensitive administrative and governance operations are strictly performed server-side.
 */

// Safely access environment variables across both Vite client and Node.js test runners
const viteEnv =
  typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env
    ? (import.meta as unknown as { env?: Record<string, string> }).env
    : {};

const nodeEnv = typeof process !== 'undefined' && process.env ? process.env : {};

function extractSupabaseUrlFromJwt(token: string): string {
  if (!token || typeof token !== 'string') return '';
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      let jsonStr = '';
      if (typeof atob !== 'undefined') {
        jsonStr = atob(base64);
      } else if (typeof Buffer !== 'undefined') {
        jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
      }
      if (jsonStr) {
        const payload = JSON.parse(jsonStr);
        if (payload && typeof payload.ref === 'string' && payload.ref.trim()) {
          return `https://${payload.ref.trim()}.supabase.co`;
        }
      }
    }
  } catch {
    // Ignore parse errors on malformed tokens
  }
  return '';
}

function cleanSupabaseUrl(url: string, anonKey: string): string {
  if (!url || typeof url !== 'string') {
    return extractSupabaseUrlFromJwt(anonKey);
  }
  const trimmed = url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // If a publishable key or malformed URL was passed, attempt extraction from JWT anon key
  const fromJwt = extractSupabaseUrlFromJwt(anonKey);
  if (fromJwt) {
    return fromJwt;
  }
  // If user provided a raw project ref (e.g. "xpqswzkvcgkkodehvrun")
  if (/^[a-z0-9]{20}$/i.test(trimmed)) {
    return `https://${trimmed}.supabase.co`;
  }
  return '';
}

const supabaseAnonKey =
  (viteEnv?.VITE_SUPABASE_ANON_KEY || nodeEnv.VITE_SUPABASE_ANON_KEY || nodeEnv.SUPABASE_ANON_KEY || '').trim();
const rawSupabaseUrl =
  viteEnv?.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL || nodeEnv.SUPABASE_URL || '';
const supabaseUrl = cleanSupabaseUrl(rawSupabaseUrl, supabaseAnonKey);

let clientInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }
  if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    return false;
  }
  if (
    supabaseUrl === 'https://your-project.supabase.co' ||
    supabaseAnonKey === 'your-anon-key'
  ) {
    return false;
  }
  return true;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: typeof window !== 'undefined',
        },
      });
    } catch (err) {
      console.warn('[Supabase] Failed to initialize client:', err);
      clientInstance = null;
    }
  }

  return clientInstance;
}

export const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
