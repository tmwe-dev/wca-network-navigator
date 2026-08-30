/**
 * DAL V3 — Modulo 1 (Identità e accesso).
 *
 * Sola lettura in questa fase: la V3 mostra chi ha accesso, non modifica
 * ancora la whitelist. Le mutazioni arrivano quando il modulo è completo.
 */
import { supabase } from "@/integrations/supabase/client";

export interface V3Operatore {
  readonly id: string;
  readonly email: string;
  readonly nome: string | null;
  readonly attivo: boolean;
  readonly admin: boolean;
  readonly ultimoAccesso: string | null;
  readonly accessi: number;
  /** `true` quando l'email è in whitelist ma non esiste un record operatore. */
  readonly soloWhitelist: boolean;
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Unisce whitelist (`authorized_users`) e anagrafica operatori (`operators`)
 * in una sola vista: la domanda della pagina è "chi può fare cosa", non
 * "quali righe ci sono in quale tabella".
 */
export async function listOperatoriV3(): Promise<V3Operatore[]> {
  const [whitelist, operatori] = await Promise.all([
    supabase
      .from("authorized_users")
      .select("id, email, display_name, is_active, last_login_at, login_count")
      .order("email", { ascending: true }),
    supabase.from("operators").select("id, email, name, is_active, is_admin").order("email", { ascending: true }),
  ]);

  if (whitelist.error) throw whitelist.error;
  if (operatori.error) throw operatori.error;

  const operatorByEmail = new Map<string, (typeof operatori.data)[number]>();
  for (const operator of operatori.data ?? []) {
    const key = normalizeEmail(operator.email);
    if (key) operatorByEmail.set(key, operator);
  }

  const rows: V3Operatore[] = [];
  const seen = new Set<string>();

  for (const entry of whitelist.data ?? []) {
    const key = normalizeEmail(entry.email);
    const operator = key ? operatorByEmail.get(key) : undefined;
    seen.add(key);
    rows.push({
      id: entry.id,
      email: entry.email,
      nome: operator?.name ?? entry.display_name ?? null,
      attivo: entry.is_active !== false && operator?.is_active !== false,
      admin: operator?.is_admin === true,
      ultimoAccesso: entry.last_login_at ?? null,
      accessi: entry.login_count ?? 0,
      soloWhitelist: !operator,
    });
  }

  // Operatori senza voce in whitelist: vanno mostrati, non nascosti.
  for (const operator of operatori.data ?? []) {
    const key = normalizeEmail(operator.email);
    if (!key || seen.has(key)) continue;
    rows.push({
      id: operator.id,
      email: operator.email ?? "",
      nome: operator.name ?? null,
      attivo: operator.is_active !== false,
      admin: operator.is_admin === true,
      ultimoAccesso: null,
      accessi: 0,
      soloWhitelist: false,
    });
  }

  return rows.sort((a, b) => a.email.localeCompare(b.email));
}
