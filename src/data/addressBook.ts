/**
 * DAL — Rubrica unificata indirizzi email.
 * Cerca in imported_contacts, partner_contacts e business_cards.
 * Usata dal picker CC/CCN in fase di approvazione invio.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AddressBookEntry {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  source: "contatti" | "partner" | "biglietti";
}

export const addressBookKeys = {
  search: (term: string) => ["address-book", "search", term] as const,
};

function like(term: string): string {
  return `%${term.replace(/[%,]/g, "")}%`;
}

export async function searchAddressBook(term: string, limit = 8): Promise<AddressBookEntry[]> {
  const t = term.trim();
  if (t.length < 2) return [];
  const pattern = like(t);

  const [ic, pc, bc] = await Promise.all([
    supabase
      .from("imported_contacts")
      .select("id, name, company_name, email")
      .not("email", "is", null)
      .or(`name.ilike.${pattern},email.ilike.${pattern},company_name.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from("partner_contacts")
      .select("id, name, email")
      .not("email", "is", null)
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from("business_cards")
      .select("id, contact_name, company_name, email")
      .not("email", "is", null)
      .or(`contact_name.ilike.${pattern},email.ilike.${pattern},company_name.ilike.${pattern}`)
      .limit(limit),
  ]);

  const out: AddressBookEntry[] = [];
  for (const r of ic.data ?? []) {
    if (r.email) out.push({ id: `ic-${r.id}`, email: r.email, name: r.name, company: r.company_name, source: "contatti" });
  }
  for (const r of pc.data ?? []) {
    if (r.email) out.push({ id: `pc-${r.id}`, email: r.email, name: r.name, company: null, source: "partner" });
  }
  for (const r of bc.data ?? []) {
    if (r.email)
      out.push({ id: `bc-${r.id}`, email: r.email, name: r.contact_name, company: r.company_name, source: "biglietti" });
  }

  // Dedup per email (case-insensitive)
  const seen = new Set<string>();
  return out.filter((e) => {
    const k = e.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
