/**
 * IO Mutations: Outreach Queue — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import type { Database } from "@/integrations/supabase/types";

type QueueInsert = Database["public"]["Tables"]["email_campaign_queue"]["Insert"];

export async function enqueueOutreach(items: QueueInsert[]): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase.from("email_campaign_queue").insert(items);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "email_campaign_queue" }, "enqueueOutreach"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "enqueueOutreach"));
  }
}

export async function dequeueOutreach(itemId: string): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("email_campaign_queue")
      .update({ status: "completed", sent_at: new Date().toISOString() })
      .eq("id", itemId);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "email_campaign_queue", itemId }, "dequeueOutreach"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "dequeueOutreach"));
  }
}
