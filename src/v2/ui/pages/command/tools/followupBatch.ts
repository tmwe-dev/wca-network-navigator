import { fetchContacts } from "@/v2/io/supabase/queries/contacts";
import type { Tool, ToolResult } from "./types";

const STOPWORDS = new Set([
  "follow","up","followup","cliente","clienti","inattivi","inattivo",
  "mostra","trova","prepara","batch","giorni","contattare","contatto",
]);

export const followupBatchTool: Tool = {
  id: "followup-batch",
  label: "Follow-up clienti inattivi",
  description: "Trova contatti senza attività recente e propone un batch di follow-up",

  match(prompt: string): boolean {
    const p = prompt.toLowerCase();
    if (p.includes("partner") && !p.includes("inattiv") && !p.includes("follow")) return false;
    return /follow|inattiv|riprend|ricontatt|batch.*client/.test(p);
  },

  async execute(prompt: string): Promise<ToolResult> {
    const tokens = prompt
      .toLowerCase()
      .replace(/[^a-zàèéìòùü0-9\s]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOPWORDS.has(t));
    const search = tokens[0] || undefined;

    const result = await fetchContacts({
      search,
      limit: 50,
      offset: 0,
    });

    if (result._tag === "Err") {
      throw new Error(result.error.message ?? "Errore lettura contatti");
    }

    const contacts = result.value;

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const inactive = contacts.filter((c) => {
      const lastActivity = c.lastInteractionAt
        ? new Date(c.lastInteractionAt).getTime()
        : 0;
      return lastActivity < cutoff;
    });

    return {
      kind: "card-grid",
      title: "Clienti inattivi >30gg",
      meta: {
        count: inactive.length,
        sourceLabel: "Supabase · imported_contacts",
      },
      cards: inactive.map((c) => ({
        id: c.id as string,
        title: c.name ?? c.companyName ?? "—",
        subtitle: c.companyName ?? "",
        meta: [
          c.email ?? "no-email",
          c.country ?? "—",
          c.leadStatus ?? "—",
        ],
        lastContact: c.lastInteractionAt ?? c.createdAt ?? null,
        suggestedAction: "Invia follow-up",
      })),
    };
  },
};