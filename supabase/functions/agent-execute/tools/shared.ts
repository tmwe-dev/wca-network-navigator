/**
 * tools/shared.ts — helper condivisi tra i moduli tool-per-dominio
 *
 * Estratto da `index.ts` in sessione #24 (Ondata 2, Fase 4 Vol. I — split
 * dei file monolitici). Contiene helper che vengono usati da più domini
 * (partners / activities / outreach / network), passandoli il client
 * Supabase come parametro esplicito per evitare coupling di modulo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

import { escapeLike } from "../../_shared/sqlEscape.ts";

/**
 * Risolve un partner dato `partner_id` oppure `company_name` (fuzzy).
 * Ritorna `null` se non trovato.
 */
export async function resolvePartnerId(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .eq("id", args.partner_id)
      .single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .ilike("company_name", `%${escapeLike(String(args.company_name))}%`)
      .limit(1)
      .single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  return null;
}
