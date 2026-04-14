/**
 * useActivitiesV2 — STEP 8
 * Hook for activities (outreach queue).
 */

import { useQuery } from "@tanstack/react-query";
import { fetchActivities, type ActivityFilters } from "@/v2/io/supabase/queries/activities";
import { isOk } from "@/v2/core/domain/result";
import type { Activity } from "@/v2/core/domain/entities";
import { queryKeys } from "@/lib/queryKeys";

export function useActivitiesV2(filters: ActivityFilters = {}) {
  return useQuery({
    queryKey: queryKeys.v2.activities(filters),
    queryFn: async (): Promise<readonly Activity[]> => {
      const activityResult = await fetchActivities(filters);
      if (isOk(activityResult)) return activityResult.value;
      return [];
    },
  });
}
