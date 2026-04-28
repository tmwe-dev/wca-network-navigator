import type { Tool, ToolResult } from "./types";

export const composeEmailTool: Tool = {
  id: "compose-email",
  label: "Componi email",
  description: "Apre il composer per scrivere e inviare un'email con AI",

  match(prompt: string): boolean {
    const p = prompt.toLowerCase();
    return /scrivi.*(?:e-?mail|mail)|componi.*(?:e-?mail|mail)|prepara.*(?:e-?mail|mail)|invia.*(?:e-?mail|mail)|(?:e-?mail|mail)\s+a\s|bozz[ae].*(?:e-?mail|mail)|draft.*(?:e-?mail|mail)/.test(p);
  },

  async execute(prompt: string): Promise<ToolResult> {
    const emailMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const to = emailMatch ? emailMatch[0] : "";
    const lower = prompt.toLowerCase();
    const subject = lower.includes("collabor")
      ? "Proposta di collaborazione"
      : lower.includes("uffici") || lower.includes("venire a trovare") || lower.includes("invit")
        ? "Invito presso i nostri uffici"
        : "Contatto operativo";
    const cleaned = prompt
      .replace(/scrivi\s+/gi, "")
      .replace(/componi\s+/gi, "")
      .replace(/prepara\s+/gi, "")
      .replace(/invia\s+/gi, "")
      .replace(/e-?mail\s*/gi, "")
      .replace(/mail\s*/gi, "")
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")
      .trim()
      .slice(0, 80);

    return {
      kind: "composer",
      title: "Componi email",
      meta: { count: 0, sourceLabel: "Edge · generate-email + send-email" },
      initialTo: to,
      initialSubject: subject || cleaned || "",
      initialBody: "",
      promptHint: prompt,
    };
  },
};
