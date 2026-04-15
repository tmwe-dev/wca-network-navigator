import { invokeEdgeRaw } from "@/v2/io/edge/client";
import type { Tool, ToolResult } from "./types";

interface ScrapeResult {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  emails: string[];
  phones: string[];
  length: number;
}

export const scrapeCompanyWebsiteTool: Tool = {
  id: "scrape-company-website",
  label: "Scrape sito aziendale",
  description:
    "Scarica una pagina web ed estrae email, telefoni, titolo e descrizione",
  match: (p: string) =>
    /scrape.*sito|scrape.*website|estrai.*sito|scrape\s+https?:\/\//i.test(p),
  execute: async (prompt, context) => {
    const urlMatch = prompt.match(/https?:\/\/[^\s"']+/);
    const url = (context?.payload?.url as string) ?? urlMatch?.[0];

    if (!url) {
      throw new Error(
        "URL non trovato nel prompt. Includi un link valido (https://...)",
      );
    }

    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Scrape sito web",
        description: "Scarico la pagina ed estraggo contatti pubblici.",
        details: [
          { label: "URL", value: url },
          { label: "Estraggo", value: "email, telefoni, title, meta" },
          { label: "Sorgente", value: "Edge · scrape-website" },
        ],
        governance: {
          role: "USER",
          permission: "EXECUTE:SCRAPE",
          policy: "POLICY v1.0 · SCRAPE",
        },
        pendingPayload: { url },
        toolId: "scrape-company-website",
      } as ToolResult;
    }

    const res = await invokeEdgeRaw("scrape-website", { url });
    if (res._tag === "Err")
      throw new Error(res.error.message ?? "Scrape fallito");

    const data = res.value as ScrapeResult;

    return {
      kind: "report",
      title: `Risultati scrape · ${url}`,
      meta: {
        count: data.emails.length + data.phones.length,
        sourceLabel: "Edge · scrape-website",
      },
      sections: [
        {
          heading: "Pagina",
          body: `**Titolo:** ${data.title}\n\n**Descrizione:** ${data.description}\n\n**OG Title:** ${data.ogTitle}\n\n**OG Description:** ${data.ogDescription}`,
        },
        {
          heading: `Email trovate (${data.emails.length})`,
          body: data.emails.join("\n") || "Nessuna",
        },
        {
          heading: `Telefoni trovati (${data.phones.length})`,
          body: data.phones.join("\n") || "Nessuno",
        },
      ],
    } as ToolResult;
  },
};
