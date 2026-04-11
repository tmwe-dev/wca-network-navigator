/**
 * IO Mutations: Activities — Result-based CRUD
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Activity } from "../../../core/domain/entities";
import { mapActivityRow } from "../../../core/mappers/activity-mapper";
import type { Database } from "@/integrations/supabase/types";

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];

export async function createActivity(
  input: ActivityInsert,
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
  updates: ActivityUpdate,
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
