/**
 * Tool: scrape-website — Read-only. Scrape generico di un URL (no scrittura DB).
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

function extractUrl(prompt: string): string | null {
  const m = prompt.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

export const scrapeWebsiteTool: Tool = {
  id: "scrape-website",
  label: "Scrape sito (URL)",
  description: "Estrae testo, metadati e link da un URL pubblico. Read-only, niente salvataggio in DB.",
  match: (p) => /\b(scrape|estrai|leggi|analizza)\b[^.]{0,30}\b(sito|url|website|pagina)\b/i.test(p)
    || /\bscrape\b\s+https?:\/\//i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const url = extractUrl(prompt);
    if (!url) {
      return {
        kind: "result",
        title: "URL mancante",
        message: "Specifica un URL completo (https://…).",
        meta: { count: 0, sourceLabel: "scrape-website" },
      };
    }
    const res = await invokeEdge<{ title?: string; text?: string; meta?: Record<string, string>; links?: string[]; error?: string }>(
      "scrape-website",
      { body: { url }, context: "command:scrape-website" },
    );
    if (res?.error) {
      return {
        kind: "result",
        title: "Scrape fallito",
        message: res.error,
        meta: { count: 0, sourceLabel: "Edge · scrape-website" },
      };
    }
    const sections: { heading: string; body: string }[] = [
      { heading: "URL", body: url },
      { heading: "Titolo", body: res?.title ?? "—" },
      { heading: "Estratto", body: (res?.text ?? "").slice(0, 1500) },
    ];
    if (res?.meta) {
      sections.push({
        heading: "Metadati",
        body: Object.entries(res.meta).map(([k, v]) => `${k}: ${v}`).join("\n"),
      });
    }
    if (res?.links?.length) {
      sections.push({
        heading: `Link (${res.links.length})`,
        body: res.links.slice(0, 30).join("\n"),
      });
    }
    return {
      kind: "report",
      title: "Scrape sito",
      sections,
      meta: { count: sections.length, sourceLabel: "Edge · scrape-website" },
    };
  },
};