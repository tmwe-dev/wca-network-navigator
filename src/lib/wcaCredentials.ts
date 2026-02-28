/**
 * Fetch WCA credentials from edge function with proper auth header.
 * Centralised so that useWcaSession and sessionVerifier both use it.
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
  const res = await fetch(url, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.error(`[WcaCredentials] HTTP ${res.status}: ${res.statusText}`);
    return null;
  }

  const creds = await res.json();
  if (!creds.username || !creds.password) return null;
  return creds as WcaCredentials;
}
