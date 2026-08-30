/**
 * Tool: app-map — mostra la mappa del software e la sincronizza nella KB.
 *
 * La mappa è generata dalla navigazione reale (SSOT) e salvata come voce KB
 * `data-schema/app-map`, così il prompt dell'agente resta leggero e punta
 * al documento invece di contenere l'elenco pagine.
 */
import { APP_MAP, renderAppMapMarkdown } from "@/v2/search/appMap";
import { upsertAppMapKbEntry, APP_MAP_TITLE } from "@/data/appMapKb";
import type { Tool, ToolResult } from "./types";

export const appMapTool: Tool = {
  id: "app-map",
  label: "Mappa del software",
  description:
    "Elenca pagine, campi e funzionalità dell'applicazione e aggiorna la voce KB 'Mappa Applicazione'. Usalo per domande sulla struttura del software.",
  match: (prompt: string) =>
    /\b(mappa\s+(del\s+)?(software|applicazione|programma|sistema)|struttura\s+(del\s+)?(software|applicazione)|elenco\s+(delle\s+)?pagine|quali\s+pagine)\b/i.test(
      prompt,
    ),

  execute: async (): Promise<ToolResult> => {
    const markdown = renderAppMapMarkdown();

    let syncNote = "";
    try {
      const outcome = await upsertAppMapKbEntry(markdown);
      syncNote = outcome === "created" ? "Voce KB creata." : "Voce KB aggiornata.";
    } catch (e) {
      syncNote = `Sincronizzazione KB non riuscita: ${e instanceof Error ? e.message : String(e)}`;
    }

    const detailed = APP_MAP.filter((p) => p.purpose);

    return {
      kind: "report",
      title: `Mappa Applicazione · ${APP_MAP.length} pagine`,
      meta: {
        count: APP_MAP.length,
        sourceLabel: "Navigazione (SSOT) + kb_entries",
        auditRefs: [{ kind: "kb-section", label: APP_MAP_TITLE, value: "data-schema/app-map" }],
      },
      sections: [
        { heading: "Sincronizzazione KB", body: syncNote },
        ...detailed.map((p) => ({
          heading: `${p.label} — ${p.path}`,
          body: [
            p.purpose ? `Scopo: ${p.purpose}` : "",
            p.fields?.length ? `Campi: ${p.fields.join(", ")}` : "",
            p.features?.length ? `Funzioni: ${p.features.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        })),
      ],
    };
  },
};
