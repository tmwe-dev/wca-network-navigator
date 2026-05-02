/**
 * identityLoader.ts — Carica l'identità "super_mario_identities" per uno scope.
 * Cache in-memory 5 minuti per ridurre i round-trip al DB.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface IdentityRow {
  id: string;
  scope: string;
  name: string;
  content: string;
  is_active: boolean;
  version: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: IdentityRow; expires: number }>();

const FALLBACK_IDENTITY: IdentityRow = {
  id: "fallback",
  scope: "command-director",
  name: "Direttore Operativo (fallback)",
  is_active: true,
  version: 0,
  content: `Sei il Direttore Operativo del CRM WCA. Italiano, diretto. Usa i tool quando servono. Se manca contesto chiedi.`,
};

export async function loadIdentity(
  supabase: SupabaseClient,
  scope: string,
): Promise<IdentityRow> {
  const cached = cache.get(scope);
  if (cached && cached.expires > Date.now()) return cached.data;

  const { data, error } = await supabase
    .from("super_mario_identities")
    .select("id, scope, name, content, is_active, version")
    .eq("scope", scope)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    console.warn("[super-mario] identity load failed, using fallback", { scope, error: error?.message });
    return FALLBACK_IDENTITY;
  }

  cache.set(scope, { data: data as IdentityRow, expires: Date.now() + CACHE_TTL_MS });
  return data as IdentityRow;
}

export function clearIdentityCache(): void {
  cache.clear();
}