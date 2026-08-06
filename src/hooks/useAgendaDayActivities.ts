import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { AllActivity } from "./useActivities";
import type { Reminder } from "./useReminders";
import { findAgendaDayActivities, findRespondedPartnerIds } from "@/data/agendaDay";
import { findRemindersByDueDate } from "@/data/reminders";
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
      const acts = await findAgendaDayActivities(dayStart, dayEnd, 100);

      // Fetch reminders for the day
      const rems = await findRemindersByDueDate(dayStr, 100);

      // Check which partners have responded
      const partnerIds = (acts || [])
        .filter((a) => a.partner_id && ["send_email", "follow_up"].includes(a.activity_type as string))
        .map((a) => a.partner_id as string);

      const uniquePartnerIds = [...new Set(partnerIds)];
      const respondedPartnerIds = new Set<string>();

      if (uniquePartnerIds.length > 0) {
        const responded = await findRespondedPartnerIds(uniquePartnerIds.slice(0, 100), dayStart);
        responded.forEach((id) => respondedPartnerIds.add(id));
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
