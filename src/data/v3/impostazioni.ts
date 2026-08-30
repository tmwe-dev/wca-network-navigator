/**
 * DAL V3 — pagina "Impostazioni" (trasversale).
 *
 * Sola lettura: fotografia della configurazione reale (caselle, sincronizzazione,
 * operatori, chiavi di sistema). Le modifiche restano nelle maschere dedicate.
 */
import { supabase } from "@/integrations/supabase/client";

export interface V3Casella {
  readonly id: string;
  readonly etichetta: string;
  readonly email: string;
  readonly reparto: string | null;
  readonly imapHost: string | null;
  readonly smtpHost: string | null;
  readonly rispondiA: string | null;
  readonly attiva: boolean;
  readonly ultimaSync: string | null;
}

export interface V3OperatoreSintesi {
  readonly id: string;
  readonly nome: string;
  readonly email: string | null;
  readonly attivo: boolean;
}

export interface V3Chiave {
  readonly chiave: string;
  readonly valore: string;
  readonly aggiornataIl: string | null;
}

export interface V3Impostazioni {
  readonly caselle: readonly V3Casella[];
  readonly operatori: readonly V3OperatoreSintesi[];
  readonly chiavi: readonly V3Chiave[];
  readonly chiaviTotali: number;
}

function testoValore(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

export async function getImpostazioniV3(ricercaChiave: string): Promise<V3Impostazioni> {
  const filtro = ricercaChiave.replace(/[,()\\%*]/g, " ").trim();

  let chiaviQuery = supabase
    .from("app_settings")
    .select("key, value, updated_at", { count: "exact" })
    .order("key", { ascending: true })
    .limit(100);
  if (filtro) chiaviQuery = chiaviQuery.ilike("key", `%${filtro}%`);

  const [caselle, sync, operatori, chiavi] = await Promise.all([
    supabase
      .from("shared_mailboxes")
      .select("id, label, email, department, imap_host, imap_user, smtp_host, reply_to, is_active")
      .is("deleted_at", null)
      .order("label", { ascending: true }),
    supabase.from("email_sync_state").select("shared_mailbox_id, mailbox_id, imap_user, last_sync_at"),
    supabase.from("operators").select("id, name, email, is_active").order("name", { ascending: true }),
    chiaviQuery,
  ]);

  if (caselle.error) throw caselle.error;
  if (sync.error) throw sync.error;
  if (operatori.error) throw operatori.error;
  if (chiavi.error) throw chiavi.error;

  // La sincronizzazione si aggancia alla casella per id oppure, quando l'id
  // non è valorizzato (righe storiche), per indirizzo IMAP.
  const ultimaSyncPerCasella = new Map<string, string>();
  const registra = (chiave: string | null, quando: string | null) => {
    if (!chiave || !quando) return;
    const attuale = ultimaSyncPerCasella.get(chiave);
    if (!attuale || quando > attuale) ultimaSyncPerCasella.set(chiave, quando);
  };
  for (const row of (sync.data ?? []) as {
    shared_mailbox_id: string | null;
    mailbox_id: string | null;
    imap_user: string | null;
    last_sync_at: string | null;
  }[]) {
    registra(row.shared_mailbox_id, row.last_sync_at);
    registra(row.mailbox_id, row.last_sync_at);
    registra(row.imap_user ? row.imap_user.toLowerCase() : null, row.last_sync_at);
  }

  return {
    caselle: (caselle.data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      const id = String(item.id);
      return {
        id,
        etichetta: String(item.label ?? item.email ?? "Casella"),
        email: String(item.email ?? "—"),
        reparto: (item.department as string | null) ?? null,
        imapHost: (item.imap_host as string | null) ?? null,
        smtpHost: (item.smtp_host as string | null) ?? null,
        rispondiA: (item.reply_to as string | null) ?? null,
        attiva: item.is_active !== false,
        ultimaSync:
          ultimaSyncPerCasella.get(id) ??
          ultimaSyncPerCasella.get(String(item.email ?? "").toLowerCase()) ??
          ultimaSyncPerCasella.get(String(item.imap_user ?? "").toLowerCase()) ??
          null,
      };
    }),
    operatori: (operatori.data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        nome: String(item.name ?? "Operatore"),
        email: (item.email as string | null) ?? null,
        attivo: item.is_active !== false,
      };
    }),
    chiavi: (chiavi.data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        chiave: String(item.key),
        valore: testoValore(item.value),
        aggiornataIl: (item.updated_at as string | null) ?? null,
      };
    }),
    chiaviTotali: chiavi.count ?? 0,
  };
}
