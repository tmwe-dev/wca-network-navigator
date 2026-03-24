/**
 * @deprecated Il Claude Engine V8 usa login diretto via wca-app — credenziali server-side.
 * Questa funzione è mantenuta per compatibilità con componenti legacy.
 * 🤖 Claude Engine — Diario di bordo #4
 */
import { supabase } from "@/integrations/supabase/client";

export interface WcaCredentials {
  username: string;
  password: string;
}

export async function fetchWcaCredentials(): Promise<WcaCredentials | null> {
  // Il nuovo engine non ha bisogno di credenziali — login diretto via wca-app
  // Mantenuto per backward compatibility con componenti Settings
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wca-credentials`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const creds = await res.json();
    if (!creds.username || !creds.password) return null;
    return creds as WcaCredentials;
  } catch {
    return null;
  }
}
