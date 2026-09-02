/**
 * trackUsage (frontend) — Lente 2 del Protocollo Bonifica.
 *
 * Registra il traffico reale su `public.usage_events`. Usato da
 * `useRouteUsage` per le rotte e disponibile per marcare feature sospette.
 *
 * Vincoli: fire-and-forget, nessun dato sensibile in `meta`, inserimento
 * consentito a utenti autenticati via RLS (policy INSERT authenticated).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { createLogger } from "@/lib/log";

const logger = createLogger("usage");

export type UsageKind = "route" | "feature" | "quarantine";

/** Deduplica in memoria: stessa voce non ri-loggata entro la finestra. */
const WINDOW_MS = 60_000;
const recent = new Map<string, number>();

export function trackUsage(name: string, kind: UsageKind = "feature", meta: Record<string, Json> = {}): void {
  const key = `${kind}:${name}`;
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < WINDOW_MS) return;
  recent.set(key, now);
  void supabase
    .from("usage_events")
    .insert({ name, kind, meta })
    .then(({ error }) => {
      if (error) logger.warn("trackUsage fallita", { name, kind, error: error.message });
    });
}
