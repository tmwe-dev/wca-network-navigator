/**
 * Tool: read-inbox — Read-only view of inbound messages (Funnemail/Inreach).
 * Queries channel_messages WHERE direction='inbound', most recent first.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { Tool, ToolResult } from "./types";

interface InboundRow {
  id: string;
  channel: string | null;
  from_name: string | null;
  from_address: string | null;
  subject: string | null;
  email_date: string | null;
  created_at: string | null;
  read_at: string | null;
  category: string | null;
}

export const readInboxTool: Tool = {
  id: "read-inbox",
  label: "Posta in arrivo",
  description: "Mostra i messaggi ricevuti (inbound) più recenti: email/WhatsApp/LinkedIn in entrata, mittente, oggetto, stato lettura.",
  match: (p) =>
    /\b(posta\s+in\s+arrivo|inbox|messaggi\s+ricevut|email\s+ricevut|email\s+in\s+entrata|inbound|in\s+entrata|non\s+letti|da\s+leggere|risposte\s+ricevut)\b/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const { data, error, count } = await untypedFrom("channel_messages")
      .select(
        "id,channel,from_name,from_address,subject,email_date,created_at,read_at,category",
        { count: "exact" },
      )
      .eq("direction", "inbound")
      .is("deleted_at", null)
      .order("email_date", { ascending: false, nullsFirst: false })
      .limit(30);

    if (error) {
      return {
        kind: "result",
        title: "Posta in arrivo non disponibile",
        message: `Impossibile leggere l'inbox: ${error.message}`,
        status: "error",
        meta: { count: 0, sourceLabel: "DB · channel_messages" },
      };
    }

    const rows = (data ?? []) as InboundRow[];
    if (rows.length === 0) {
      return {
        kind: "result",
        title: "Nessun messaggio in arrivo",
        message: "Non ci sono messaggi inbound recenti.",
        status: "empty",
        meta: { count: 0, sourceLabel: "DB · channel_messages" },
      };
    }

    return {
      kind: "table",
      title: "Posta in arrivo · ultimi messaggi",
      meta: { count: count ?? rows.length, sourceLabel: "DB · channel_messages (inbound)" },
      columns: [
        { key: "channel", label: "Canale" },
        { key: "from", label: "Da" },
        { key: "subject", label: "Oggetto" },
        { key: "date", label: "Data" },
        { key: "state", label: "Stato" },
      ],
      rows: rows.map((r) => ({
        id: r.id,
        channel: r.channel ?? "—",
        from: r.from_name ?? r.from_address ?? "—",
        subject: r.subject ?? "(senza oggetto)",
        date: (r.email_date ?? r.created_at ?? "").slice(0, 16).replace("T", " ") || "—",
        state: r.read_at ? "letto" : "da leggere",
      })),
      idField: "id",
      liveSource: "channel_messages",
    };
  },
};