/**
 * scrapeProspect tool — Scrapes a prospect's website and proposes updates.
 * Uses scrape-website edge function with scrape_cache.
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { Tool, ToolResult, ToolContext } from "./types";

const MATCH = /(?:scrapa|analizza|arricchisci|enrich)\s+(?:il\s+)?(?:sito|website)\s+(?:di|del|della)?\s+(?:prospect\s+)?/i;

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getCachedScrape(url: string): Promise<Record<string, unknown> | null> {
  const { data } = await untypedFrom("scrape_cache")
    .select("payload, scraped_at")
    .eq("url", url)
    .maybeSingle();

  if (!data) return null;
  const rec = data as { payload: Record<string, unknown>; scraped_at: string };
  const age = Date.now() - new Date(rec.scraped_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return rec.payload;
}

async function setCachedScrape(url: string, payload: Record<string, unknown>): Promise<void> {
  await untypedFrom("scrape_cache")
    .upsert({ url, payload, scraped_at: new Date().toISOString() });
}

export const scrapeProspectTool: Tool = {
  id: "scrape-prospect-website",
  label: "Analizza Sito Prospect",
  description: "Scrapa il sito web di un prospect ed estrae informazioni utili (email, telefono, descrizione)",

  match(prompt: string): boolean {
    return MATCH.test(prompt);
  },

  async execute(prompt: string, context?: ToolContext): Promise<ToolResult> {
    if (context?.confirmed && context.payload) {
      const payload = context.payload as Record<string, string>;
      const prospectId = payload.prospectId;
      const updateData: Record<string, string> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (k !== "prospectId") updateData[k] = v;
      }
      const { error } = await untypedFrom("prospects")
        .update(updateData)
        .eq("id", prospectId);

      if (error) {
        return { kind: "result", title: "Errore", message: `Errore aggiornamento: ${(error as Error).message}` };
      }
      return { kind: "result", title: "Prospect Aggiornato", message: "Dati del prospect aggiornati con successo." };
    }

    const nameMatch = prompt.match(/prospect\s+(.+?)(?:\s*$|[,.])/i);
    const searchTerm = nameMatch?.[1]?.trim() ?? prompt.replace(MATCH, "").trim();

    if (!searchTerm) {
      return { kind: "result", title: "Errore", message: "Specifica il nome del prospect da analizzare." };
    }

    const { data: prospect, error: pErr } = await untypedFrom("prospects")
      .select("id, company_name, website, email, phone")
      .or(`company_name.ilike.%${searchTerm}%`)
      .limit(1)
      .maybeSingle();

    if (pErr || !prospect) {
      return { kind: "result", title: "Prospect Non Trovato", message: `Nessun prospect trovato per "${searchTerm}".` };
    }

    const rec = prospect as Record<string, unknown>;
    const website = rec.website as string | undefined;
    if (!website) {
      return { kind: "result", title: "Nessun Sito", message: `${rec.company_name as string} non ha un sito web registrato.` };
    }

    // Cache lookup
    const cached = await getCachedScrape(website);
    let scraped: Record<string, unknown>;

    if (cached) {
      scraped = cached;
    } else {
      const { data, error: sErr } = await supabase.functions.invoke("scrape-website", {
        body: { url: website, mode: "static" },
      });
      if (sErr || !data) {
        return { kind: "result", title: "Errore Scraping", message: `Impossibile analizzare ${website}: ${sErr?.message ?? "errore sconosciuto"}` };
      }
      scraped = data as Record<string, unknown>;
      await setCachedScrape(website, scraped);
    }

    const emails = scraped.emails as string[] | undefined;
    const phones = scraped.phones as string[] | undefined;
    const description = scraped.description as string | undefined;

    const proposedUpdates: Record<string, string> = {};
    const details: Array<{ label: string; value: string }> = [];

    if (emails?.length && !rec.email) {
      proposedUpdates.email = emails[0];
      details.push({ label: "Email", value: emails[0] });
    }
    if (phones?.length && !rec.phone) {
      proposedUpdates.phone = phones[0];
      details.push({ label: "Telefono", value: phones[0] });
    }
    if (description) {
      proposedUpdates.profile_description = description.slice(0, 500);
      details.push({ label: "Descrizione", value: description.slice(0, 200) });
    }

    if (details.length === 0) {
      return {
        kind: "result",
        title: `Analisi ${rec.company_name as string}`,
        message: `Sito analizzato (${website}) ma nessun dato nuovo trovato.`,
      };
    }

    return {
      kind: "approval",
      title: `Aggiorna ${rec.company_name as string}`,
      description: `Dati estratti da ${website}. Vuoi aggiornare il prospect?`,
      details,
      governance: { role: "operator", permission: "update:prospect", policy: "approval_required" },
      pendingPayload: { prospectId: rec.id as string, ...proposedUpdates },
      toolId: "scrape-prospect-website",
    };
  },
};
