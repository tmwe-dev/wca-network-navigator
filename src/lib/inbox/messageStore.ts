/**
 * Message Store — utilità di merge/dedup per `channel_messages`,
 * usato sia dalla query iniziale sia dal listener realtime.
 *
 * Vol. II §10.1 (idempotenza) — INSERT realtime + page query possono
 * produrre duplicati transitori; il merge per ID garantisce convergenza.
 */

import type { ChannelMessage, ChannelKind } from "./types";

/**
 * Unisce due liste di messaggi rimuovendo duplicati per `id`,
 * mantenendo l'ordine cronologico discendente (più recente primo).
 */
export function mergeMessages<T extends ChannelKind>(
  existing: ReadonlyArray<ChannelMessage<T>>,
  incoming: ReadonlyArray<ChannelMessage<T>>
): ChannelMessage<T>[] {
  const map = new Map<string, ChannelMessage<T>>();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m); // incoming wins
  return Array.from(map.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

/**
 * Inserisce un singolo messaggio nuovo in cima a una lista esistente,
 * deduplicando per `id` e per `message_id_external` (più resiliente
 * a race con sync IMAP UID che potrebbe ri-emettere lo stesso messaggio).
 */
export function prependMessage<T extends ChannelKind>(
  existing: ReadonlyArray<ChannelMessage<T>>,
  incoming: ChannelMessage<T>
): ChannelMessage<T>[] {
  const dupById = existing.find((m) => m.id === incoming.id);
  if (dupById) return existing.slice();

  if (incoming.message_id_external) {
    const dupByExternal = existing.find(
      (m) => m.message_id_external === incoming.message_id_external
    );
    if (dupByExternal) {
      // Sostituisci con la versione più recente (potrebbe avere body più completo)
      return existing.map((m) => (m === dupByExternal ? incoming : m));
    }
  }

  return [incoming, ...existing];
}

/**
 * Filtra messaggi per thread (utile in ContactListPanel + WhatsApp/LinkedIn views).
 */
export function filterByThread<T extends ChannelKind>(
  messages: ReadonlyArray<ChannelMessage<T>>,
  threadId: string
): ChannelMessage<T>[] {
  return messages.filter((m) => m.thread_id === threadId);
}

/**
 * Conta messaggi non letti (read_at === null).
 */
export function countUnread<T extends ChannelKind>(
  messages: ReadonlyArray<ChannelMessage<T>>
): number {
  return messages.reduce((acc, m) => acc + (m.read_at === null ? 1 : 0), 0);
}

/**
 * Raggruppa messaggi per thread_id, ordinando i thread per il
 * messaggio più recente. Restituisce mappa stabile.
 */
export function groupByThread<T extends ChannelKind>(
  messages: ReadonlyArray<ChannelMessage<T>>
): Array<{ threadId: string; messages: ChannelMessage<T>[]; lastAt: string }> {
  const groups = new Map<string, ChannelMessage<T>[]>();
  for (const m of messages) {
    const key = m.thread_id ?? m.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  return Array.from(groups.entries())
    .map(([threadId, msgs]) => ({
      threadId,
      messages: msgs.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      lastAt: msgs[msgs.length - 1].created_at,
    }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
