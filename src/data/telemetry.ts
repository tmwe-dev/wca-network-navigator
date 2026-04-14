/**
 * DAL — page_events
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertPageEvent(payload: Record<string, unknown>) {
  await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)("page_events").insert(payload);
}
