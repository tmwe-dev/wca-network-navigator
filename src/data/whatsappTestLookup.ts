/**
 * WhatsApp Test Lookup — DAL dedicato alla pagina /test-extensions.
 * Cerca un destinatario reale (con telefono) attraverso più tabelle CRM
 * così il test invia al numero giusto e non a un nome ambiguo.
 */
import { supabase } from "@/integrations/supabase/client";

export interface WaTestRecipient {
  id: string;
  source: "imported_contacts" | "partner_contacts" | "partners" | "business_cards";
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  /** numero scelto come destinatario primario (E.164 normalizzato se possibile) */
  bestPhone: string | null;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^0-9+]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (digits.length < 7) return null;
  return cleaned.startsWith("+") ? cleaned : "+" + digits;
}

function pickBest(phone: string | null, mobile: string | null): string | null {
  return normalizePhone(mobile) || normalizePhone(phone);
}

export async function searchWaRecipients(query: string, limit = 20): Promise<WaTestRecipient[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const out: WaTestRecipient[] = [];

  // imported_contacts
  {
    const { data } = await supabase
      .from("imported_contacts")
      .select("id, name, company_name, email, phone, mobile")
      .or(`name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like},mobile.ilike.${like}`)
      .limit(limit);
    for (const r of data || []) {
      out.push({
        id: r.id as string,
        source: "imported_contacts",
        name: (r.name as string) || "",
        company: (r.company_name as string) || null,
        email: (r.email as string) || null,
        phone: (r.phone as string) || null,
        mobile: (r.mobile as string) || null,
        bestPhone: pickBest(r.phone as string, r.mobile as string),
      });
    }
  }

  // partner_contacts (+ partners join per company)
  {
    const { data } = await supabase
      .from("partner_contacts")
      .select("id, name, title, email, direct_phone, mobile, partners(company_name)")
      .or(`name.ilike.${like},email.ilike.${like},direct_phone.ilike.${like},mobile.ilike.${like}`)
      .limit(limit);
    for (const r of (data as Array<Record<string, unknown>>) || []) {
      const partners = r.partners as { company_name?: string } | null;
      out.push({
        id: r.id as string,
        source: "partner_contacts",
        name: (r.name as string) || "",
        company: partners?.company_name || (r.title as string) || null,
        email: (r.email as string) || null,
        phone: (r.direct_phone as string) || null,
        mobile: (r.mobile as string) || null,
        bestPhone: pickBest(r.direct_phone as string, r.mobile as string),
      });
    }
  }

  // partners
  {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name, email, phone, mobile")
      .or(`company_name.ilike.${like},email.ilike.${like},phone.ilike.${like},mobile.ilike.${like}`)
      .limit(limit);
    for (const r of data || []) {
      out.push({
        id: r.id as string,
        source: "partners",
        name: (r.company_name as string) || "",
        company: (r.company_name as string) || null,
        email: (r.email as string) || null,
        phone: (r.phone as string) || null,
        mobile: (r.mobile as string) || null,
        bestPhone: pickBest(r.phone as string, r.mobile as string),
      });
    }
  }

  // business_cards
  {
    const { data } = await supabase
      .from("business_cards")
      .select("id, contact_name, company_name, email, phone, mobile")
      .or(`contact_name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like},mobile.ilike.${like}`)
      .limit(limit);
    for (const r of data || []) {
      out.push({
        id: r.id as string,
        source: "business_cards",
        name: (r.contact_name as string) || "",
        company: (r.company_name as string) || null,
        email: (r.email as string) || null,
        phone: (r.phone as string) || null,
        mobile: (r.mobile as string) || null,
        bestPhone: pickBest(r.phone as string, r.mobile as string),
      });
    }
  }

  // record con telefono in cima
  out.sort((a, b) => Number(!!b.bestPhone) - Number(!!a.bestPhone));
  return out.slice(0, limit);
}