/**
 * scrapePartner tool — Scrapes a partner's website and proposes updates.
 * Wraps existing scrape-website edge function with scrape_cache.
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { Tool, ToolResult, ToolContext } from "./types";

const MATCH = /(?:scrapa|analizza|arricchisci|enrich)\s+(?:il\s+)?(?:sito|website)\s+(?:di|del|della)?\s+(?:partner\s+)?/i;

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

export const scrapePartnerTool: Tool = {
  id: "scrape-partner-website",
  label: "Analizza Sito Partner",
  description: "Scrapa il sito web di un partner WCA ed estrae informazioni utili (email, telefono, descrizione)",

  match(prompt: string): boolean {
    return MATCH.test(prompt);
  },

  async execute(prompt: string, context?: ToolContext): Promise<ToolResult> {
    // If confirmed, apply the update
    if (context?.confirmed && context.payload) {
      const payload = context.payload as Record<string, string>;
      const partnerId = payload.partnerId;
      const updateData: Record<string, string> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (k !== "partnerId") updateData[k] = v;
      }
      const { error } = await supabase
        .from("partners")
        .update(updateData as unknown as Record<string, never>)
        .eq("id", partnerId);

      if (error) {
        return { kind: "result", title: "Errore", message: `Errore aggiornamento: ${error.message}` };
      }
      return { kind: "result", title: "Partner Aggiornato", message: "Dati del partner aggiornati con successo." };
    }

    // Extract partner name/id from prompt
    const nameMatch = prompt.match(/partner\s+(.+?)(?:\s*$|[,.])/i);
    const searchTerm = nameMatch?.[1]?.trim() ?? prompt.replace(MATCH, "").trim();

    if (!searchTerm) {
      return { kind: "result", title: "Errore", message: "Specifica il nome del partner da analizzare." };
    }

    // Find partner
    const { data: partner, error: pErr } = await supabase
      .from("partners")
      .select("id, company_name, website, email, phone")
      .or(`company_name.ilike.%${searchTerm}%,company_alias.ilike.%${searchTerm}%`)
      .limit(1)
      .maybeSingle();

    if (pErr || !partner) {
      return { kind: "result", title: "Partner Non Trovato", message: `Nessun partner trovato per "${searchTerm}".` };
    }

    const website = partner.website;
    if (!website) {
      return { kind: "result", title: "Nessun Sito", message: `${partner.company_name} non ha un sito web registrato.` };
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

    // Build proposed updates
    const proposedUpdates: Record<string, string> = {};
    const details: Array<{ label: string; value: string }> = [];

    if (emails?.length && !partner.email) {
      proposedUpdates.email = emails[0];
      details.push({ label: "Email", value: emails[0] });
    }
    if (phones?.length && !partner.phone) {
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
        title: `Analisi ${partner.company_name}`,
        message: `Sito analizzato (${website}) ma nessun dato nuovo trovato rispetto a quanto già registrato.`,
      };
    }

    return {
      kind: "approval",
      title: `Aggiorna ${partner.company_name}`,
      description: `Dati estratti da ${website}. Vuoi aggiornare il partner?`,
      details,
      governance: { role: "operator", permission: "update:partner", policy: "approval_required" },
      pendingPayload: { partnerId: partner.id, ...proposedUpdates },
      toolId: "scrape-partner-website",
    };
  },
};
