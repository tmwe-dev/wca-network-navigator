/**
 * IO Mutations: Activities — Result-based CRUD
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Activity, type ActivityType } from "../../../core/domain/entities";
import { mapActivityRow } from "../../../core/mappers/activity-mapper";

export interface CreateActivityInput {
  readonly title: string;
  readonly activity_type: ActivityType;
  readonly source_id: string;
  readonly partner_id?: string | null;
  readonly description?: string | null;
  readonly due_date?: string | null;
  readonly priority?: string;
}

export async function createActivity(
  input: CreateActivityInput,
): Promise<Result<Activity, AppError>> {
  try {
    const { data, error } = await supabase
      .from("activities")
      .insert(input)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "activities", operation: "insert",
      }, "createActivity"));
    }

    return mapActivityRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createActivity"));
  }
}

export async function updateActivity(
  activityId: string,
  updates: Partial<CreateActivityInput & { status: string; completed_at: string | null }>,
): Promise<Result<Activity, AppError>> {
  try {
    const { data, error } = await supabase
      .from("activities")
      .update(updates)
      .eq("id", activityId)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "activities", activityId, operation: "update",
      }, "updateActivity"));
    }

    return mapActivityRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateActivity"));
  }
}

export async function deleteActivity(
  activityId: string,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", activityId);

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "activities", activityId, operation: "delete",
      }, "deleteActivity"));
    }

    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deleteActivity"));
  }
}
