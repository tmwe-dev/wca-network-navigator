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
  grounding?: string,
): Promise<string> {
  const messages = [
    ...(grounding ? [{ role: "system" as const, content: grounding }] : []),
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

/** Contesto con cui la V3 marca le proprie conversazioni. */
const CONTESTO_V3 = "v3/command";

/** Conversazioni recenti registrate dal cervello, per il rail sinistro. */
export async function listConversazioniCommandV3(): Promise<V3ConversazioneRecente[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at, created_at")
    .eq("page_context", CONTESTO_V3)
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

/** Riapre una conversazione salvata: restituisce i turni in ordine. */
export async function caricaConversazioneCommandV3(id: string): Promise<readonly V3CommandMessaggio[]> {
  const { data, error } = await supabase.from("ai_conversations").select("messages").eq("id", id).single();
  if (error) throw error;

  const grezzi = Array.isArray((data as { messages?: unknown } | null)?.messages)
    ? ((data as { messages: unknown[] }).messages as unknown[])
    : [];

  const out: V3CommandMessaggio[] = [];
  for (const item of grezzi) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (r.role !== "user" && r.role !== "assistant") continue;
    if (typeof r.content !== "string") continue;
    out.push({ ruolo: r.role, contenuto: r.content });
  }
  return out;
}

/**
 * Salva (crea o aggiorna) la conversazione corrente.
 * Restituisce l'id da riutilizzare per i turni successivi.
 */
export async function salvaConversazioneCommandV3(params: {
  readonly id: string | null;
  readonly messaggi: readonly V3CommandMessaggio[];
}): Promise<string | null> {
  const { data: sessione } = await supabase.auth.getUser();
  const userId = sessione.user?.id;
  if (!userId || params.messaggi.length === 0) return params.id;

  const messages = params.messaggi.map((m) => ({ role: m.ruolo, content: m.contenuto }));
  const titolo = (params.messaggi.find((m) => m.ruolo === "user")?.contenuto ?? "Conversazione").slice(0, 80);

  if (params.id) {
    const { error } = await supabase
      .from("ai_conversations")
      .update({ messages, title: titolo, updated_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) throw error;
    return params.id;
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert([{ user_id: userId, page_context: CONTESTO_V3, title: titolo, messages }])
    .select("id")
    .single();
  if (error) throw error;
  return data ? String((data as { id: unknown }).id) : null;
}
