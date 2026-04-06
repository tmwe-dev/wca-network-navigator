import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    queryKey: ["today-activities"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("activities")
        .select("id, activity_type, title, source_id, source_type, description, completed_at, source_meta, status")
        .gte("created_at", today.toISOString())
        .in("status", ["pending", "in_progress", "completed"] as any)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((a): TodayActivity => {
        const meta = (a.source_meta || {}) as any;
        return {
          id: a.id,
          activityType: a.activity_type,
          title: a.title,
          sourceId: a.source_id,
          sourceType: a.source_type,
          description: a.description,
          completedAt: a.completed_at,
          contactName: meta.name || a.title?.split("—")[0]?.trim() || "—",
          company: meta.company || a.title?.split("—")[1]?.trim() || "",
        };
      });
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
