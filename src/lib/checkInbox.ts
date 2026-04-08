import { supabase } from "@/integrations/supabase/client";
import { ApiError } from "@/lib/api/apiError";
import { safeParseCheckInboxResult } from "@/lib/api/checkInbox.schemas";

/**
 * callCheckInbox — chiama la edge function `check-inbox`.
 *
 * Vol. II §5.3: errori standardizzati via `ApiError` con `code` esplicito.
 * Vol. II §5.3: validazione runtime best-effort della risposta via zod
 * (strangler — log warn su mismatch, mai throw).
 *
 * Il chiamante può fare `instanceof ApiError` per agire sul codice senza
 * parsing di stringhe.
 */
export async function callCheckInbox(): Promise<unknown> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: "Sessione assente — login richiesto",
    });
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  let res: Response;
  try {
    res = await fetch(`https://${projectId}.supabase.co/functions/v1/check-inbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    throw ApiError.from(err, "callCheckInbox");
  }

  if (!res.ok) {
    throw await ApiError.fromResponse(res, "callCheckInbox");
  }

  const json = await res.json();
  // best-effort runtime check (mai bloccante)
  safeParseCheckInboxResult(json);
  return json;
}
