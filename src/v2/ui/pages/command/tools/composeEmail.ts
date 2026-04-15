import type { Tool, ToolResult } from "./types";

export const composeEmailTool: Tool = {
  id: "compose-email",
  label: "Componi email",
  description: "Apre il composer per scrivere e inviare un'email con AI",

  match(prompt: string): boolean {
    const p = prompt.toLowerCase();
    return /scrivi.*email|componi.*email|invia.*email|email\s+a\s|bozz[ae].*email|draft.*email/.test(p);
  },

  async execute(prompt: string): Promise<ToolResult> {
    const emailMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const to = emailMatch ? emailMatch[0] : "";
    const cleaned = prompt
      .replace(/scrivi\s+/gi, "")
      .replace(/componi\s+/gi, "")
      .replace(/invia\s+/gi, "")
      .replace(/email\s*/gi, "")
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")
      .trim()
      .slice(0, 80);

    return {
      kind: "composer",
      title: "Componi email",
      meta: { count: 0, sourceLabel: "Edge · generate-email + send-email" },
      initialTo: to,
      initialSubject: cleaned || "",
      initialBody: "",
      promptHint: prompt,
    };
  },
};
