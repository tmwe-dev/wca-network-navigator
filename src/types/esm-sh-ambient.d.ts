// Ambient declaration for Deno-style esm.sh imports used by supabase/functions/_shared/*
// referenced from frontend tests.
declare module "https://esm.sh/@supabase/supabase-js@2.39.3" {
  export type SupabaseClient = unknown;
  export const createClient: (...args: unknown[]) => unknown;
}
