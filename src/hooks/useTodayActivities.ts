import { useQuery } from "@tanstack/react-query";
import { findTodayActivities } from "@/data/activities";
import { asSourceMeta } from "@/lib/types/sourceMeta";
import { queryKeys } from "@/lib/queryKeys";

export interface TodayActivity {
  id: string;
  activityType: string;
  title: string;
  sourceId: string;
  sourceType: string;
  description: string | null;
  completedAt: string | null;
  contactName: string;
  company: string;
  status: string;
}

export function useTodayActivities() {
  return useQuery({
    queryKey: queryKeys.activities.today,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const data = await findTodayActivities(today.toISOString());

      return data.map((a): TodayActivity => {
        const meta = asSourceMeta(a.source_meta);
        return {
          id: a.id,
          activityType: a.activity_type,
          title: a.title,
          sourceId: a.source_id,
          sourceType: a.source_type,
          description: a.description,
          completedAt: a.completed_at,
          contactName: (meta.contact_name as string) || a.title?.split("—")[0]?.trim() || "—",
          company: (meta.company_name as string) || a.title?.split("—")[1]?.trim() || "",
          status: a.status,
        };
      });
    },
    staleTime: 60_000,
    refetchInterval: 90_000,
  });
}
