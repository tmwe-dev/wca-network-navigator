/**
 * Global error catchers — logs unhandled errors/rejections to app_error_logs.
 * Called once from main.tsx.
 */
import { supabase } from "@/integrations/supabase/client";

async function logGlobalError(entry: {
  error_type: string;
  error_message: string;
  error_stack?: string | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("app_error_logs").insert({
      user_id: user.id,
      error_type: entry.error_type,
      error_message: entry.error_message,
      error_stack: entry.error_stack?.substring(0, 2000) ?? null,
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    });
  } catch {
    // silent — avoid infinite loops
  }
}

export function installGlobalErrorCatchers() {
  window.addEventListener("unhandledrejection", (event) => {
    logGlobalError({
      error_type: "unhandled_rejection",
      error_message: event.reason?.message || String(event.reason),
      error_stack: event.reason?.stack,
    });
  });

  window.addEventListener("error", (event) => {
    logGlobalError({
      error_type: "js_error",
      error_message: event.message,
      error_stack: `${event.filename}:${event.lineno}:${event.colno}`,
    });
  });
}
