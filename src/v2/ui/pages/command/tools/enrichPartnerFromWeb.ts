import { fetchPartnerById } from "@/v2/io/supabase/queries/partners";
import { updatePartner } from "@/v2/io/supabase/mutations/partners";
import { invokeEdgeRaw } from "@/v2/io/edge/client";
import type { Tool, ToolResult } from "./types";

interface ScrapeResult {
  emails: string[];
  phones: string[];
  title: string;
  description: string;
}

export const enrichPartnerFromWebTool: Tool = {
  id: "enrich-partner-from-web",
  label: "Arricchisci partner dal web",
  description:
    "Scrapa il sito del partner, estrae dati, aggiorna il record con email/telefono mancanti",
  match: (p: string) =>
    /(arricchisci|enrich|approfondisci).*partner/i.test(p),
  execute: async (prompt, context) => {
    const idMatch = prompt.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
    const partnerId = (context?.payload?.partnerId as string) ?? idMatch?.[0];
    if (!partnerId)
      throw new Error("Partner ID non trovato. Specifica un UUID partner.");

    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Arricchimento partner",
        description:
          "Scrapa sito → estrae contatti → aggiorna record partner.",
        details: [
          { label: "Partner ID", value: partnerId },
          {
            label: "Pipeline",
            value: "scrape-website → updatePartner",
          },
        ],
        governance: {
          role: "USER",
          permission: "WRITE:PARTNERS + EXECUTE:SCRAPE",
          policy: "POLICY v1.0 · ENRICH",
        },
        pendingPayload: { partnerId },
        toolId: "enrich-partner-from-web",
      } as ToolResult;
    }

    // Step 1: read partner
    const pRes = await fetchPartnerById(partnerId);
    if (pRes._tag === "Err")
      throw new Error(pRes.error.message ?? "Partner non trovato");
    const partner = pRes.value;

    const website =
      (partner as Record<string, unknown>).website as string | undefined;
    if (!website)
      throw new Error(
        "Partner senza sito web — impossibile fare scraping",
      );

    // Step 2: scrape
    const scrapeRes = await invokeEdgeRaw("scrape-website", { url: website });
    if (scrapeRes._tag === "Err")
      throw new Error(scrapeRes.error.message ?? "Scrape fallito");
    const scraped = scrapeRes.value as ScrapeResult;

    // Step 3: build updates for missing fields
    const updates: Record<string, unknown> = {};
    const partnerRec = partner as Record<string, unknown>;
    if (scraped.emails.length > 0 && !partnerRec.email)
      updates.email = scraped.emails[0];
    if (scraped.phones.length > 0 && !partnerRec.phone)
      updates.phone = scraped.phones[0];

    if (Object.keys(updates).length > 0) {
      const upRes = await updatePartner(partnerId, updates);
      if (upRes._tag === "Err")
        throw new Error(upRes.error.message ?? "Update partner fallito");
    }

    return {
      kind: "report",
      title: `Partner arricchito`,
      meta: {
        count: Object.keys(updates).length,
        sourceLabel: "scrape + updatePartner",
      },
      sections: [
        {
          heading: "Dati estratti",
          body: `Email: ${scraped.emails.join(", ") || "—"}\nTelefoni: ${scraped.phones.join(", ") || "—"}\nTitolo sito: ${scraped.title}`,
        },
        {
          heading: "Campi aggiornati",
          body:
            Object.entries(updates)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join("\n") || "Nessuno (dati già completi)",
        },
      ],
    } as ToolResult;
  },
};
