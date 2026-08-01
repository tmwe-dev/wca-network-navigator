/**
 * IO Queries: Outreach Queue (email_campaign_queue) — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type OutreachQueueItem } from "../../../core/domain/entities";
import { mapOutreachQueueRow } from "../../../core/mappers/outreach-queue-mapper";

export async function fetchOutreachQueue(status?: string): Promise<Result<OutreachQueueItem[], AppError>> {
  try {
    let query = supabase
      .from("email_campaign_queue")
      .select("*")
      .order("position", { ascending: true });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "email_campaign_queue" }, "fetchOutreachQueue"));
    if (!data) return ok([]);
    const items: OutreachQueueItem[] = [];
    for (const row of data) {
      const mapped = mapOutreachQueueRow(row);
      if (mapped._tag === "Err") return mapped;
      items.push(mapped.value);
    }
    return ok(items);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchOutreachQueue"));
  }
}
