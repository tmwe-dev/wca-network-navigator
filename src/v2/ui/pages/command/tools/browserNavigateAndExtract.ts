/**
 * browserNavigateAndExtract tool — Navigate to external URL and extract text via headless browser.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult, ToolContext } from "./types";

const MATCH = /(?:apri|naviga|vai\s+a|visita|leggi)\s+(?:il\s+)?(?:sito|pagina|url)\s+/i;

export const browserNavigateAndExtractTool: Tool = {
  id: "browser-navigate-extract",
  label: "Naviga e Estrai (Browser)",
  description: "Apre una pagina nel browser headless, estrae testo da selettori CSS specificati",

  match(prompt: string): boolean {
    return MATCH.test(prompt) && /https?:\/\//.test(prompt);
  },

  async execute(prompt: string, _context?: ToolContext): Promise<ToolResult> {
    // Extract URL from prompt
    const urlMatch = prompt.match(/(https?:\/\/[^\s,)]+)/);
    if (!urlMatch) {
      return { kind: "result", title: "Errore", message: "Nessun URL trovato nel prompt. Specifica un URL valido (https://...)." };
    }
    const url = urlMatch[1];

    // Extract selector if mentioned
    const selectorMatch = prompt.match(/selettore\s+["']?([^"'\s,]+)["']?/i);
    const selector = selectorMatch?.[1] ?? "body";

    try {
      const { data, error } = await supabase.functions.invoke("browser-action", {
        body: {
          actions: [
            { type: "navigate", url },
            { type: "waitFor", ms: 2000 },
            { type: "readText", selector },
            { type: "screenshot" },
          ],
          allowedDomains: [new URL(url).hostname],
        },
      });

      if (error) {
        return { kind: "result", title: "Errore Browser", message: error.message };
      }

      if (data?.fallback) {
        return { kind: "result", title: "Browser Non Disponibile", message: "Il browser headless non è configurato. Configura BROWSERLESS_URL e BROWSERLESS_TOKEN." };
      }

      const textResult = data?.results?.find((r: Record<string, unknown>) => r?.type === "readText");
      const text = typeof textResult?.text === "string" ? textResult.text : "Nessun testo estratto";

      return {
        kind: "report",
        title: `Contenuto da ${url}`,
        sections: [
          { heading: "URL", body: data?.finalUrl ?? url },
          { heading: "Testo Estratto", body: text.slice(0, 3000) },
        ],
        meta: { count: 1, sourceLabel: "Browser Action" },
      };
    } catch (e) {
      return { kind: "result", title: "Errore", message: e instanceof Error ? e.message : String(e) };
    }
  },
};
