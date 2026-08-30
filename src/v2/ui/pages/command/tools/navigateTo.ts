/**
 * Tool: navigate-to — routing dell'agente verso qualsiasi pagina/funzione.
 *
 * Risolve la destinazione sulla Mappa Applicazione (SSOT navigazione) e,
 * se il match è univoco, porta l'utente sulla pagina. Altrimenti propone
 * le alternative migliori.
 */
import { findDestinations } from "@/v2/search/appMap";
import { navigateToPath } from "@/v2/navigation/navBridge";
import type { Tool, ToolResult } from "./types";

const TRIGGER =
  /\b(vai\s+(a|su|in|al|alla)|apri(mi)?|portami|mostrami\s+la\s+pagina|dove\s+(trovo|si\s+trova|sta)|come\s+(ci\s+)?(arrivo|raggiungo)|naviga)\b/i;

export const navigateToTool: Tool = {
  id: "navigate-to",
  label: "Vai a una pagina o funzione",
  description:
    "Instrada l'utente verso qualsiasi pagina o funzione dell'applicazione (routing). Usalo per 'vai a…', 'apri…', 'dove trovo…'.",
  match: (prompt: string) => TRIGGER.test(prompt),

  execute: async (prompt: string): Promise<ToolResult> => {
    const matches = findDestinations(prompt, 5);

    if (matches.length === 0) {
      return {
        kind: "result",
        status: "empty",
        title: "Destinazione non trovata",
        message:
          "Non ho trovato una pagina corrispondente. Prova con il nome della funzione (es. «firma», «cockpit», «blacklist», «biglietti da visita»).",
        meta: { count: 0, sourceLabel: "Mappa Applicazione" },
      };
    }

    const top = matches[0];
    const unique = matches.length === 1 || top.score >= matches[1].score * 2;

    if (unique) {
      navigateToPath(top.path);
      return {
        kind: "result",
        status: "ok",
        title: `Apro: ${top.label}`,
        message: `${top.hint}\n\nPercorso: ${top.path}`,
        meta: {
          count: 1,
          sourceLabel: "Mappa Applicazione",
          auditRefs: [{ kind: "kb-section", label: "data-schema/app-map", value: top.path }],
        },
      };
    }

    return {
      kind: "table",
      title: "Destinazioni possibili",
      meta: { count: matches.length, sourceLabel: "Mappa Applicazione" },
      columns: [
        { key: "label", label: "Pagina / funzione" },
        { key: "path", label: "Percorso" },
        { key: "hint", label: "A cosa serve" },
      ],
      rows: matches.map((m) => ({ label: m.label, path: m.path, hint: m.hint })),
    };
  },
};
