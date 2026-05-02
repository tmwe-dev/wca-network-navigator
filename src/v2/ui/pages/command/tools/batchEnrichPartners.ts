/**
 * Tool: batch-enrich-partners
 *
 * Arricchisce in batch i partner SELEZIONATI nell'ultima ricerca Command
 * (vedi `lastQueryResultContext`). Una sola conferma iniziale, poi esegue
 * sequenzialmente lo scraping/enrichment via edge `enrich-partner-website`.
 *
 * Differenza vs `enrich-partner-from-web*`:
 *  - non chiede UUID nel prompt
 *  - usa direttamente i partnerIds dell'ultima query (es. "partner di Malta" → 9 ID)
 *  - salta partner senza website, riporta esito completati/saltati/falliti
 */
import { invokeEdgeRaw } from "@/v2/io/edge/client";
import { fetchPartnerById } from "@/v2/io/supabase/queries/partners";
import { getLastQueryResultContext } from "../lib/lastQueryResultContext";
import type { Tool, ToolResult } from "./types";

const MATCH = /\b(arricchisci|arricchimento|enrich)\b.*\b(dati|partner|sito|siti|web)\b|\bdati\s+mancanti\b|\barricchisci\s+(?:i\s+)?(?:dati|siti)\b/i;

interface EnrichResult {
  ok: number;
  skipped: number;
  failed: number;
  details: Array<{ id: string; name: string; outcome: "ok" | "skipped" | "failed"; reason?: string }>;
}

export const batchEnrichPartnersTool: Tool = {
  id: "batch-enrich-partners",
  label: "Arricchimento batch partner",
  description:
    "Arricchisce dati e siti dei partner trovati nell'ultima ricerca (es. partner di Malta). Una sola conferma, poi esegue.",
  match: (p: string) => MATCH.test(p),

  execute: async (prompt, context): Promise<ToolResult> => {
    const ctx = getLastQueryResultContext();
    const ids = (context?.payload?.partnerIds as string[] | undefined) ?? ctx?.partnerIds ?? [];
    const selectionLabel = (context?.payload?.selectionLabel as string | undefined)
      ?? ctx?.selectionLabel
      ?? "partner selezionati";

    if (!ids || ids.length === 0) {
      return {
        kind: "result",
        title: "Nessun partner da arricchire",
        message:
          "Non trovo partner nell'ultima ricerca. Prima cerca i partner (es. 'partner di Malta'), poi richiedi l'arricchimento.",
        meta: { count: 0, sourceLabel: "batch-enrich-partners" },
      };
    }

    // Step di conferma — UNA SOLA volta, poi esegue senza riproporre la domanda.
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: `Arricchire ${ids.length} ${selectionLabel}?`,
        description:
          "Scarico le pagine dei siti web e aggiorno email/telefono/descrizione mancanti. Salto chi non ha sito.",
        details: [
          { label: "Partner selezionati", value: String(ids.length) },
          { label: "Origine", value: ctx?.originalPrompt ?? prompt },
          { label: "Pipeline", value: "enrich-partner-website (sequenziale)" },
        ],
        governance: {
          role: "USER",
          permission: "WRITE:PARTNERS + EXECUTE:SCRAPE",
          policy: "POLICY v1.0 · BATCH ENRICH",
        },
        pendingPayload: { partnerIds: ids, selectionLabel },
        toolId: "batch-enrich-partners",
      };
    }

    // Esecuzione sequenziale (no parallel: rispettiamo i rate-limit dell'edge)
    const out: EnrichResult = { ok: 0, skipped: 0, failed: 0, details: [] };
    for (const id of ids) {
      const pRes = await fetchPartnerById(id);
      if (pRes._tag === "Err") {
        out.failed++;
        out.details.push({ id, name: id.slice(0, 8), outcome: "failed", reason: "partner non trovato" });
        continue;
      }
      const partner = pRes.value as unknown as Record<string, unknown>;
      const name = (partner.company_name as string | undefined)
        ?? (partner.company_alias as string | undefined)
        ?? id.slice(0, 8);
      const website = (partner.website as string | undefined)?.trim();
      if (!website) {
        out.skipped++;
        out.details.push({ id, name, outcome: "skipped", reason: "nessun website" });
        continue;
      }
      try {
        const r = await invokeEdgeRaw("enrich-partner-website", { partner_id: id });
        if (r._tag === "Err") {
          out.failed++;
          out.details.push({ id, name, outcome: "failed", reason: r.error.message ?? "edge error" });
        } else {
          out.ok++;
          out.details.push({ id, name, outcome: "ok" });
        }
      } catch (e) {
        out.failed++;
        out.details.push({
          id,
          name,
          outcome: "failed",
          reason: e instanceof Error ? e.message : "errore sconosciuto",
        });
      }
    }

    const lines = out.details.map((d) => {
      const icon = d.outcome === "ok" ? "✓" : d.outcome === "skipped" ? "·" : "✗";
      return `${icon} ${d.name}${d.reason ? ` — ${d.reason}` : ""}`;
    });

    return {
      kind: "report",
      title: `Arricchimento ${selectionLabel}`,
      meta: { count: out.ok, sourceLabel: "Edge · enrich-partner-website (batch)" },
      sections: [
        {
          heading: "Riepilogo",
          body: `**Completati:** ${out.ok}\n**Saltati (no sito):** ${out.skipped}\n**Falliti:** ${out.failed}\n**Totale:** ${ids.length}`,
        },
        {
          heading: "Dettaglio",
          body: lines.join("\n") || "—",
        },
      ],
    };
  },
};