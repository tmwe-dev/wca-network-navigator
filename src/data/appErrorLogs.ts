/**
 * DAL — app_error_logs.
 * Estratto dal bypass DAL diretto di `src/lib/errorCatchers.ts`.
 * Semantica invariata: insert best-effort, errore non propagato dal caller.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type AppErrorLogInsert = Database["public"]["Tables"]["app_error_logs"]["Insert"];

export interface AppErrorLogEntry {
  readonly user_id: string;
  readonly error_type: string;
  readonly error_message: string;
  readonly error_stack: string | null;
  readonly page_url: string;
  readonly user_agent: string;
  readonly component_stack?: string | null;
  readonly metadata?: { readonly [key: string]: Json | undefined };
}

export async function insertAppErrorLog(entry: AppErrorLogEntry): Promise<void> {
  const payload: AppErrorLogInsert = {
    user_id: entry.user_id,
    error_type: entry.error_type,
    error_message: entry.error_message,
    error_stack: entry.error_stack,
    page_url: entry.page_url,
    user_agent: entry.user_agent,
    ...(entry.component_stack !== undefined ? { component_stack: entry.component_stack } : {}),
    ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
  };
  await supabase.from("app_error_logs").insert(payload);
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
