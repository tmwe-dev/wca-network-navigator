import { fetchPartnerById } from "@/v2/io/supabase/queries/partners";
import { updatePartner } from "@/v2/io/supabase/mutations/partners";
import { invokeEdgeRaw } from "@/v2/io/edge/client";
import type { Tool, ToolResult } from "./types";

interface ScrapePayload {
  emails: string[];
  phones: string[];
  title: string;
  description: string;
  ogDescription: string;
  headings: string[];
}

export const enrichPartnerFromWebsiteTool: Tool = {
  id: "enrich-partner-from-website",
  label: "Arricchisci partner dal sito web",
  description:
    "Scrapa il sito del partner via edge function, propone aggiornamenti (email, phone, descrizione)",
  match: (p: string) =>
    /(arricchisci|enrich|analizza.*sito).*partner/i.test(p),
  execute: async (prompt, context) => {
    const idMatch = prompt.match(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
    );
    const partnerId = (context?.payload?.partnerId as string) ?? idMatch?.[0];
    if (!partnerId)
      throw new Error("Partner ID non trovato. Specifica un UUID partner.");

    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Arricchimento partner dal sito web",
        description:
          "Scrapa il sito web del partner → estrae contatti e descrizione → propone aggiornamento record.",
        details: [
          { label: "Partner ID", value: partnerId },
          { label: "Pipeline", value: "scrape-website (edge) → updatePartner" },
          { label: "Sorgente", value: "Edge · scrape-website" },
        ],
        governance: {
          role: "USER",
          permission: "WRITE:PARTNERS + EXECUTE:SCRAPE",
          policy: "POLICY v1.0 · ENRICH",
        },
        pendingPayload: { partnerId },
        toolId: "enrich-partner-from-website",
      } as ToolResult;
    }

    // Step 1: read partner
    const pRes = await fetchPartnerById(partnerId);
    if (pRes._tag === "Err")
      throw new Error(pRes.error.message ?? "Partner non trovato");
    const partner = pRes.value;
    const partnerRec = partner as unknown as Record<string, unknown>;
    const website = partnerRec.website as string | undefined;
    if (!website)
      throw new Error("Partner senza sito web — impossibile fare scraping");

    // Step 2: scrape via edge
    const scrapeRes = await invokeEdgeRaw("scrape-website", {
      url: website,
      mode: "static",
    });
    if (scrapeRes._tag === "Err")
      throw new Error(scrapeRes.error.message ?? "Scrape fallito");
    const scraped = scrapeRes.value as ScrapePayload;

    // Step 3: build updates for missing fields
    const updates: Record<string, unknown> = {};
    if (scraped.emails.length > 0 && !partnerRec.email)
      updates.email = scraped.emails[0];
    if (scraped.phones.length > 0 && !partnerRec.phone)
      updates.phone = scraped.phones[0];
    if (
      (scraped.description || scraped.ogDescription) &&
      !partnerRec.profile_description
    )
      updates.profile_description =
        scraped.description || scraped.ogDescription;

    if (Object.keys(updates).length > 0) {
      const upRes = await updatePartner(partnerId, updates);
      if (upRes._tag === "Err")
        throw new Error(upRes.error.message ?? "Update partner fallito");
    }

    return {
      kind: "report",
      title: `Partner arricchito dal sito`,
      meta: {
        count: Object.keys(updates).length,
        sourceLabel: "Edge · scrape-website → updatePartner",
      },
      sections: [
        {
          heading: "Dati estratti",
          body: `**Email:** ${scraped.emails.join(", ") || "—"}\n**Telefoni:** ${scraped.phones.join(", ") || "—"}\n**Titolo sito:** ${scraped.title}\n**Descrizione:** ${scraped.description || scraped.ogDescription || "—"}`,
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
