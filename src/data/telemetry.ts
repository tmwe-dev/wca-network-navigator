/**
 * DAL — page_events
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertPageEvent(payload: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- page_events not in generated types (view-based)
  await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)("page_events").insert(payload);
}
