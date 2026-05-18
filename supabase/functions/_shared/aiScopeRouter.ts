/**
 * aiScopeRouter — Resolves provider/model for a logical scope from the
 * `ai_routing_config` DB table. Cached in-memory (TTL 60s) for performance.
 *
 * Used by aiGateway.aiChat({ scope }) to dynamically pick the right backend
 * (Anthropic / OpenAI / Google) per scope without redeploy.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PROVIDER_CONFIG, type ProviderKey } from "./aiGatewayConfig.ts";

export interface ScopeRoute {
  provider: ProviderKey;
  model: string;
  tier?: string | null;
}

type CacheEntry = { route: ScopeRoute | null; expiresAt: number };

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function getServiceClient(): ReturnType<typeof createClient> | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Resolve route for a scope. Returns null if no DB row found.
 * Soft-fails on any DB/network error and returns null (caller falls back to MODEL_MAP).
 */
export async function resolveScopeRoute(scope: string | undefined): Promise<ScopeRoute | null> {
  if (!scope) return null;

  const cached = CACHE.get(scope);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.route;

  const supa = getServiceClient();
  if (!supa) return null;

  try {
    const { data, error } = await supa
      .from("ai_routing_config")
      .select("provider, model, tier")
      .eq("scope", scope)
      .maybeSingle();
    if (error || !data) {
      CACHE.set(scope, { route: null, expiresAt: now + TTL_MS });
      return null;
    }
    const provider = String((data as Record<string, unknown>).provider) as ProviderKey;
    if (!PROVIDER_CONFIG[provider]) {
      CACHE.set(scope, { route: null, expiresAt: now + TTL_MS });
      return null;
    }
    const route: ScopeRoute = {
      provider,
      model: String((data as Record<string, unknown>).model),
      tier: (data as Record<string, unknown>).tier as string | null,
    };
    CACHE.set(scope, { route, expiresAt: now + TTL_MS });
    return route;
  } catch {
    CACHE.set(scope, { route: null, expiresAt: now + TTL_MS });
    return null;
  }
}

/** Force cache invalidation (e.g. after admin update from UI). */
export function invalidateScopeCache(scope?: string): void {
  if (scope) CACHE.delete(scope);
  else CACHE.clear();
}