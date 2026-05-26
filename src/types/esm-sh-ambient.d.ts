// Ambient declaration for Deno-style esm.sh imports used by supabase/functions/_shared/*
// referenced from frontend tests.
declare module "https://esm.sh/@supabase/supabase-js@2.39.3" {
  // Deliberately typed as `any` so Deno edge function files (consumed by frontend tests
 // via direct relative import) typecheck without modifying production edge code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type SupabaseClient = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const createClient: (...args: any[]) => any;
}
