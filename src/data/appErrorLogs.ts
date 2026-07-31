/**
 * DAL — app_error_logs.
 * Estratto dal bypass DAL diretto di `src/lib/errorCatchers.ts`.
 * Semantica invariata: insert best-effort, errore non propagato dal caller.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AppErrorLogEntry {
  readonly user_id: string;
  readonly error_type: string;
  readonly error_message: string;
  readonly error_stack: string | null;
  readonly page_url: string;
  readonly user_agent: string;
  readonly component_stack?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export async function insertAppErrorLog(entry: AppErrorLogEntry): Promise<void> {
  await supabase.from("app_error_logs").insert({ ...entry } as never);
}

export async function insertReactCrashLog(entry: {
  user_id: string;
  error_message: string;
  error_stack: string | null;
  component_stack: string | null;
  page_url: string;
  user_agent: string;
}): Promise<void> {
  await supabase.from("app_error_logs").insert({
    user_id: entry.user_id,
    error_type: "react_crash",
    error_message: entry.error_message,
    error_stack: entry.error_stack,
    component_stack: entry.component_stack,
    page_url: entry.page_url,
    user_agent: entry.user_agent,
    metadata: { timestamp: new Date().toISOString() },
  });
}
