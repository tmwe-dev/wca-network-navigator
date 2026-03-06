import { supabase } from "@/integrations/supabase/client";
import { asTerminalLog, toJson } from "@/lib/partnerUtils";

/**
 * Append a log entry to a download job's terminal_log field.
 * Keeps the last 150 entries to prevent unbounded growth.
 */
export async function appendLog(jobId: string, type: string, msg: string) {
  const ts = new Date().toLocaleTimeString("it-IT", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  try {
    const { data } = await supabase
      .from("download_jobs")
      .select("terminal_log")
      .eq("id", jobId)
      .single();
    const current = asTerminalLog(data?.terminal_log);
    const updated = [...current, { ts, type, msg }].slice(-150);
    await supabase
      .from("download_jobs")
      .update({ terminal_log: toJson(updated) })
      .eq("id", jobId);
  } catch {
    // Silently fail — terminal log is non-critical
  }
}
