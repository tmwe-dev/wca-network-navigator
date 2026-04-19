import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { AllActivity } from "./useActivities";
import type { Reminder } from "./useReminders";
import { createLogger } from "@/lib/log";
import { queryKeys } from "@/lib/queryKeys";

const _log = createLogger("useAgendaDayActivities");

export interface AgendaDayData {
  activities: AllActivity[];
  reminders: Reminder[];
  respondedPartnerIds: Set<string>;
}

export function useAgendaDayActivities(day: Date | null) {
  const dayStr = day ? format(day, "yyyy-MM-dd") : null;

  return useQuery({
    queryKey: queryKeys.activities.agendaDay(dayStr, false),
    queryFn: async (): Promise<AgendaDayData> => {
      if (!dayStr) return { activities: [], reminders: [], respondedPartnerIds: new Set() };

      const dayStart = `${dayStr}T00:00:00`;
      const dayEnd = `${dayStr}T23:59:59`;

      // Fetch activities for the day
      const { data: acts, error: actErr } = await supabase
        .from("activities")
        .select(`
          *,
          partners(company_name, company_alias, country_code, country_name, city, enriched_at, website, logo_url, email),
          team_members(name),
          selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, direct_phone, mobile, title, contact_alias)
        `)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false });

      if (actErr) throw actErr;

      // Fetch reminders for the day
      const { data: rems, error: remErr } = await supabase
        .from("reminders")
        .select(`*, partners(company_name, country_code)`)
        .eq("due_date", dayStr)
        .order("due_date", { ascending: true });

      if (remErr) throw remErr;

      // Check which partners have responded
      const partnerIds = (acts || [])
        .filter(a => a.partner_id && ["send_email", "follow_up"].includes(a.activity_type))
        .map(a => a.partner_id!);

      const uniquePartnerIds = [...new Set(partnerIds)];
      const respondedPartnerIds = new Set<string>();

      if (uniquePartnerIds.length > 0) {
        const { data: inbound } = await supabase
          .from("channel_messages")
          .select("partner_id")
          .in("partner_id", uniquePartnerIds.slice(0, 100))
          .eq("direction", "inbound")
          .gte("created_at", dayStart);

        if (inbound) {
          inbound.forEach(m => {
            if (m.partner_id) respondedPartnerIds.add(m.partner_id);
          });
        }
      }

      return {
        activities: (acts || []) as unknown as AllActivity[],
        reminders: (rems || []) as Reminder[],
        respondedPartnerIds,
      };
    },
    enabled: !!dayStr,
    staleTime: 30_000,
  });
}
