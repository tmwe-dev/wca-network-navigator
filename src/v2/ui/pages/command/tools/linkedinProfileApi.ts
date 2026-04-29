/**
 * Tool: linkedin-profile-api — Read-only. Recupera dati profilo LinkedIn via API/extension.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

function extractLiUrl(prompt: string): string | null {
  const m = prompt.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|company)\/[A-Za-z0-9_\-%]+/i);
  return m ? m[0] : null;
}

export const linkedinProfileApiTool: Tool = {
  id: "linkedin-profile-api",
  label: "Profilo LinkedIn (read)",
  description: "Recupera i dati pubblici di un profilo o azienda LinkedIn (URL richiesto). Read-only.",
  match: (p) => /\b(profilo|profile|company|azienda)\b[^.]{0,20}\blinkedin\b/i.test(p)
    || /\blinkedin\.com\/(?:in|company)\//i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const url = extractLiUrl(prompt);
    if (!url) {
      return {
        kind: "result",
        title: "URL LinkedIn mancante",
        message: "Specifica un URL linkedin.com/in/… o linkedin.com/company/…",
        meta: { count: 0, sourceLabel: "linkedin-profile-api" },
      };
    }
    const res = await invokeEdge<{
      name?: string; headline?: string; company?: string; location?: string;
      about?: string; experience?: Array<{ title?: string; company?: string; period?: string }>;
      error?: string;
    }>("linkedin-profile-api", { body: { url }, context: "command:linkedin-profile-api" });
    if (res?.error) {
      return {
        kind: "result",
        title: "Profilo LinkedIn non disponibile",
        message: res.error,
        meta: { count: 0, sourceLabel: "Edge · linkedin-profile-api" },
      };
    }
    const sections: { heading: string; body: string }[] = [
      { heading: "Identità", body: `${res?.name ?? "—"}\n${res?.headline ?? ""}` },
      { heading: "Azienda / Località", body: `${res?.company ?? "—"} · ${res?.location ?? "—"}` },
    ];
    if (res?.about) sections.push({ heading: "About", body: res.about.slice(0, 1000) });
    if (res?.experience?.length) {
      sections.push({
        heading: "Esperienza",
        body: res.experience.slice(0, 8).map((e) => `• ${e.title ?? "—"} @ ${e.company ?? "—"} (${e.period ?? "—"})`).join("\n"),
      });
    }
    return {
      kind: "report",
      title: "Profilo LinkedIn",
      sections,
      meta: { count: sections.length, sourceLabel: "Edge · linkedin-profile-api" },
    };
  },
};