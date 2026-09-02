/**
 * usageTrack — Lente 2 / Fase 4 del Protocollo Bonifica.
 *
 * Contatore di traffico reale per edge function e pezzi in quarantena.
 * Fire-and-forget: non blocca mai la risposta, non lancia mai errori.
 *
 * Uso in una edge function:
 *   import { trackUsage } from "../_shared/usageTrack.ts";
 *   trackUsage("mia-function", "edge");            // contatore invocazioni
 *   trackUsage("mia-function:ramo-x", "quarantine", { note: "candidato rimozione" });
 *
 * Il registro `usage_events` è la prova fattuale ("in N giorni nessuno l'ha
 * chiamato") che trasforma un'opinione in un dato prima della rimozione.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

export type UsageKind = "edge" | "route" | "quarantine" | "feature";

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function trackUsage(name: string, kind: UsageKind = "edge", meta: Record<string, unknown> = {}): void {
  try {
    const sb = getClient();
    if (!sb) return;
    const p = sb.from("usage_events").insert({ name, kind, meta });
    // fire-and-forget: non attendiamo la Promise
    void p.then(({ error }) => {
      if (error) console.warn(`[usageTrack] insert fallita per ${name}: ${error.message}`);
    });
  } catch {
    /* mai bloccare la funzione per telemetria */
  }
}
