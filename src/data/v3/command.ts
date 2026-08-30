/**
 * DAL V3 — pagina "Command" (trasversale).
 *
 * Ponte verso il cervello esistente (`ai-assistant`, scope `command`) tramite
 * il gateway SSOT `invokeAi`: nessuna nuova pipeline AI, nessun tool duplicato.
 * Le azioni proposte restano proposte: la V3 non esegue nulla da qui.
 */
import { invokeAi } from "@/lib/ai/invokeAi";
import { supabase } from "@/integrations/supabase/client";

export interface V3CommandMessaggio {
  readonly ruolo: "user" | "assistant";
  readonly contenuto: string;
}

interface RispostaAssistente {
  readonly content?: string;
  readonly message?: string;
  readonly reply?: string;
  readonly error?: string;
}

/** Invia il turno corrente con la cronologia recente e restituisce il testo. */
export async function chiediACommandV3(
  storico: readonly V3CommandMessaggio[],
  domanda: string,
): Promise<string> {
  const messages = [
    ...storico.slice(-8).map((m) => ({ role: m.ruolo, content: m.contenuto })),
    { role: "user" as const, content: domanda },
  ];

  const data = await invokeAi<RispostaAssistente>("ai-assistant", {
    scope: "command",
    context: { source: "v3/CommandPage", route: "/v3/command", mode: "chat" },
    body: { messages },
  });

  return data.content || data.message || data.reply || data.error || "Nessuna risposta.";
}

export interface V3ConversazioneRecente {
  readonly id: string;
  readonly titolo: string;
  readonly aggiornataIl: string | null;
}

/** Conversazioni recenti registrate dal cervello, per il rail sinistro. */
export async function listConversazioniCommandV3(): Promise<V3ConversazioneRecente[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at, created_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id),
      titolo: String(item.title ?? "Conversazione"),
      aggiornataIl: (item.updated_at as string | null) ?? (item.created_at as string | null) ?? null,
    };
  });
}
