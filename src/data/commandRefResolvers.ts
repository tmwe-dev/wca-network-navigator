/**
 * DAL — risoluzione riferimenti partner/contatto per i tool "write" della
 * Command page. Estratto 1:1 da `_helpers/writePayload.ts`.
 */
import { supabase } from "@/integrations/supabase/client";

export async function resolvePartnerRefById(id: string): Promise<{ id: string; company_name: string } | null> {
  const { data } = await supabase.from("partners").select("id, company_name").eq("id", id).maybeSingle();
  return data ? { id: data.id, company_name: data.company_name ?? "" } : null;
}

export async function resolvePartnerRefByTerm(term: string): Promise<{ id: string; company_name: string } | null> {
  const { data } = await supabase
    .from("partners")
    .select("id, company_name")
    .or(`company_name.ilike.%${term}%,company_alias.ilike.%${term}%`)
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, company_name: data.company_name ?? "" } : null;
}

export async function resolveContactRefById(id: string): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase.from("imported_contacts").select("id, name").eq("id", id).maybeSingle();
  return data ? { id: data.id, name: data.name ?? "" } : null;
}

export async function resolveContactRefByTerm(term: string): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from("imported_contacts")
    .select("id, name")
    .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, name: data.name ?? "" } : null;
}
