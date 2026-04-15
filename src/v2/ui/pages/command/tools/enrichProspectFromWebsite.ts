import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeRaw } from "@/v2/io/edge/client";
import type { Tool, ToolResult } from "./types";

interface ScrapePayload {
  emails: string[];
  phones: string[];
  title: string;
  description: string;
  ogDescription: string;
}

export const enrichProspectFromWebsiteTool: Tool = {
  id: "enrich-prospect-from-website",
  label: "Arricchisci prospect dal sito web",
  description:
    "Scrapa il sito del prospect via edge function, propone aggiornamenti",
  match: (p: string) =>
    /(arricchisci|enrich|analizza.*sito).*prospect/i.test(p),
  execute: async (prompt, context) => {
    const idMatch = prompt.match(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
    );
    const prospectId = (context?.payload?.prospectId as string) ?? idMatch?.[0];
    if (!prospectId)
      throw new Error("Prospect ID non trovato. Specifica un UUID.");

    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Arricchimento prospect dal sito web",
        description:
          "Scrapa il sito web del prospect → estrae contatti → propone aggiornamento.",
        details: [
          { label: "Prospect ID", value: prospectId },
          { label: "Pipeline", value: "scrape-website (edge) → update prospect" },
          { label: "Sorgente", value: "Edge · scrape-website" },
        ],
        governance: {
          role: "USER",
          permission: "WRITE:PROSPECTS + EXECUTE:SCRAPE",
          policy: "POLICY v1.0 · ENRICH",
        },
        pendingPayload: { prospectId },
        toolId: "enrich-prospect-from-website",
      } as ToolResult;
    }

    // Step 1: fetch prospect
    const { data: prospect, error: fetchErr } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", prospectId)
      .maybeSingle();

    if (fetchErr || !prospect)
      throw new Error(fetchErr?.message ?? "Prospect non trovato");

    const rec = prospect as Record<string, unknown>;
    const website = rec.website as string | undefined;
    if (!website)
      throw new Error("Prospect senza sito web — impossibile fare scraping");

    // Step 2: scrape
    const scrapeRes = await invokeEdgeRaw("scrape-website", {
      url: website,
      mode: "static",
    });
    if (scrapeRes._tag === "Err")
      throw new Error(scrapeRes.error.message ?? "Scrape fallito");
    const scraped = scrapeRes.value as ScrapePayload;

    // Step 3: build updates
    const updates: Record<string, unknown> = {};
    if (scraped.emails.length > 0 && !rec.email)
      updates.email = scraped.emails[0];
    if (scraped.phones.length > 0 && !rec.phone)
      updates.phone = scraped.phones[0];

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from("prospects")
        .update(updates)
        .eq("id", prospectId);
      if (upErr) throw new Error(upErr.message ?? "Update prospect fallito");
    }

    return {
      kind: "report",
      title: `Prospect arricchito dal sito`,
      meta: {
        count: Object.keys(updates).length,
        sourceLabel: "Edge · scrape-website → prospect",
      },
      sections: [
        {
          heading: "Dati estratti",
          body: `**Email:** ${scraped.emails.join(", ") || "—"}\n**Telefoni:** ${scraped.phones.join(", ") || "—"}\n**Titolo:** ${scraped.title}`,
        },
        {
          heading: "Campi aggiornati",
          body:
            Object.entries(updates)
              .map(([k, v]) => `**${k}:** ${String(v)}`)
              .join("\n") || "Nessuno (dati già completi)",
        },
      ],
    } as ToolResult;
  },
};
