import { supabase } from "@/integrations/supabase/client";

export async function callCheckInbox(): Promise<any> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Non autenticato");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/check-inbox`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Errore sconosciuto" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}
