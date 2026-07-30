/**
 * DAL — dati agenda giornaliera (attività + partner con risposta inbound).
 */
import { supabase } from "@/integrations/supabase/client";

const AGENDA_ACTIVITY_SELECT = `
          *,
          partners(company_name, company_alias, country_code, country_name, city, enriched_at, website, logo_url, email, lead_status),
          team_members(name),
          selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, direct_phone, mobile, title, contact_alias)
        `;

export async function findAgendaDayActivities(
  dayStart: string,
  dayEnd: string,
  limit = 100,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from("activities")
    .select(AGENDA_ACTIVITY_SELECT)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

/** Partner con almeno un messaggio inbound dal `since` indicato. */
export async function findRespondedPartnerIds(
  partnerIds: string[],
  since: string,
): Promise<string[]> {
  if (partnerIds.length === 0) return [];
  const { data } = await supabase
    .from("channel_messages")
    .select("partner_id")
    .in("partner_id", partnerIds)
    .eq("direction", "inbound")
    .gte("created_at", since);
  return (data ?? []).map((m) => m.partner_id).filter((id): id is string => !!id);
}