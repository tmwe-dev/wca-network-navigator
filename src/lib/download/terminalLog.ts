import { supabase } from "@/integrations/supabase/client";

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
    const current = (data?.terminal_log as any[] || []);
    const updated = [...current, { ts, type, msg }].slice(-150);
    await supabase
      .from("download_jobs")
      .update({ terminal_log: updated as any })
      .eq("id", jobId);
  } catch {
    // Silently fail — terminal log is non-critical
  }
}
