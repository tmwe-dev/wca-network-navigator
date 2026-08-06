/**
 * supabaseClient.ts — Canonical Supabase client factory for edge functions.
 *
 * Edge functions Deno NON usano i tipi `Database` generati: usare
 * `createClient()` senza generic forza l'inferenza a `GenericSchema = never`,
 * causando `data: never[]` su qualunque `.from().select()` e propagando
 * errori `TS2339 Property does not exist on type 'never'` su tutto l'albero.
 *
 * Questo modulo espone:
 *   - `AnySupabaseClient`: tipo permissivo unico, condiviso tra moduli.
 *   - `createServiceClient()`: client con SERVICE_ROLE_KEY (bypass RLS).
 *   - `createUserClient(authHeader)`: client con ANON_KEY + Authorization.
 *
 * Tutti i file che ricevono `supabase` come parametro DEVONO tipizzarlo
 * come `AnySupabaseClient` per evitare mismatch a catena.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type AnySupabaseClient = ReturnType<typeof createClient>;

type DenoRuntime = typeof globalThis & {
  Deno: { env: { get(name: string): string | undefined } };
};

const env = (name: string): string => (globalThis as DenoRuntime).Deno.env.get(name)!;

export function createServiceClient(): AnySupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
}

export function createUserClient(authHeader: string): AnySupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
}
