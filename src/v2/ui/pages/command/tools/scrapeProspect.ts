/**
 * scrapeProspect tool — Scrapes a prospect's website and proposes updates.
 * Uses scrape-website edge function with scrape_cache.
 */
import { supabase } from "@/integrations/supabase/client";
import { getCachedScrapePayload } from "@/application/data/commandScrapePartner";
import { upsertScrapeCacheEntry } from "@/application/data/scrapeCache";
import { applyProspectEnrichment, findProspectBySearchTerm } from "@/application/data/prospects";
import type { Tool, ToolResult, ToolContext } from "./types";

const MATCH = /(?:scrapa|analizza|arricchisci|enrich)\s+(?:il\s+)?(?:sito|website)\s+(?:di|del|della)?\s+(?:prospect\s+)?/i;

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getCachedScrape(url: string): Promise<Record<string, unknown> | null> {
  const rec = await getCachedScrapePayload(url);
  if (!rec) return null;
  const age = Date.now() - new Date(rec.scraped_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return rec.payload;
}

async function setCachedScrape(url: string, payload: Record<string, unknown>): Promise<void> {
  await upsertScrapeCacheEntry({ url, payload });
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
      // Il payload di approvazione è generato dinamicamente e può contenere
      // campi non presenti su `prospects` (es. `profile_description`, che sta
      // su `partners`): il DAL filtra sulle colonne reali invece di far
      // fallire l'intero update.
      try {
        const { appliedFields, ignoredFields } = await applyProspectEnrichment(prospectId, updateData);
        if (appliedFields.length === 0) {
          return {
            kind: "result",
            title: "Nessun aggiornamento",
            message: `Nessun campo applicabile al prospect${ignoredFields.length ? ` (ignorati: ${ignoredFields.join(", ")})` : ""}.`,
          };
        }
        return {
          kind: "result",
          title: "Prospect Aggiornato",
          message: `Aggiornati: ${appliedFields.join(", ")}${ignoredFields.length ? ` · ignorati: ${ignoredFields.join(", ")}` : ""}.`,
        };
      } catch (error) {
        return { kind: "result", title: "Errore", message: `Errore aggiornamento: ${(error as Error).message}` };
      }
    }

    const nameMatch = prompt.match(/prospect\s+(.+?)(?:\s*$|[,.])/i);
    const searchTerm = nameMatch?.[1]?.trim() ?? prompt.replace(MATCH, "").trim();

    if (!searchTerm) {
      return { kind: "result", title: "Errore", message: "Specifica il nome del prospect da analizzare." };
    }

    const prospect = await findProspectBySearchTerm(searchTerm);

    if (!prospect) {
      return { kind: "result", title: "Prospect Non Trovato", message: `Nessun prospect trovato per "${searchTerm}".` };
    }

    const rec = prospect;
    const website = rec.website ?? undefined;
    if (!website) {
      return { kind: "result", title: "Nessun Sito", message: `${rec.company_name} non ha un sito web registrato.` };
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
        title: `Analisi ${rec.company_name}`,
        message: `Sito analizzato (${website}) ma nessun dato nuovo trovato.`,
      };
    }

    return {
      kind: "approval",
      title: `Aggiorna ${rec.company_name}`,
      description: `Dati estratti da ${website}. Vuoi aggiornare il prospect?`,
      details,
      governance: { role: "operator", permission: "update:prospect", policy: "approval_required" },
      pendingPayload: { prospectId: rec.id, ...proposedUpdates },
      toolId: "scrape-prospect-website",
    };
  },
};
