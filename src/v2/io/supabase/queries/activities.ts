/**
 * IO Queries: Activities — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Activity, type ActivityType, type ActivityStatus } from "../../../core/domain/entities";
import { mapActivityRow } from "../../../core/mappers/activity-mapper";

export interface ActivityFilters {
  readonly partnerId?: string;
  readonly status?: ActivityStatus;
  readonly activityType?: ActivityType;
  readonly since?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export async function fetchActivities(
  filters?: ActivityFilters,
): Promise<Result<Activity[], AppError>> {
  try {
    let query = supabase.from("activities").select("*");

    if (filters?.partnerId) query = query.eq("partner_id", filters.partnerId);
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.activityType) query = query.eq("activity_type", filters.activityType);
    if (filters?.since) query = query.gte("created_at", filters.since);

    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;
    query = query.range(offset, offset + limit - 1).order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "activities",
      }, "fetchActivities"));
    }

    if (!data) return ok([]);

    const activities: Activity[] = [];
    for (const row of data) {
      const mapped = mapActivityRow(row);
      if (mapped._tag === "Err") return mapped;
      activities.push(mapped.value);
    }
    return ok(activities);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchActivities"));
  }
}
