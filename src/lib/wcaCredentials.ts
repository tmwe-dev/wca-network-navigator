/**
 * Fetch WCA credentials from edge function with proper auth header.
 * Logs failures to localStorage for diagnostic panel.
 */
import { supabase } from "@/integrations/supabase/client";

export interface WcaCredentials {
  username: string;
  password: string;
}

export async function fetchWcaCredentials(): Promise<WcaCredentials | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    console.warn("[WcaCredentials] No active session — cannot fetch credentials");
    return null;
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wca-credentials`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const errorInfo = { status: res.status, body: body.slice(0, 500), timestamp: new Date().toISOString() };
      console.error(`[WcaCredentials] HTTP ${res.status}: ${res.statusText}`);
      try { localStorage.setItem("last_wca_error", JSON.stringify(errorInfo)); } catch {}
      try {
        localStorage.setItem("last_failed_network_call", JSON.stringify({
          endpoint: "get-wca-credentials",
          status: res.status,
          ts: new Date().toISOString(),
        }));
      } catch {}
      return null;
    }

    const creds = await res.json();
    if (!creds.username || !creds.password) return null;
    return creds as WcaCredentials;
  } catch (err) {
    const errorInfo = { status: 0, body: String(err), timestamp: new Date().toISOString() };
    try { localStorage.setItem("last_wca_error", JSON.stringify(errorInfo)); } catch {}
    console.error("[WcaCredentials] Network error:", err);
    return null;
  }
}
