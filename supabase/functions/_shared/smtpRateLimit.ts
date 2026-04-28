/**
 * smtpRateLimit.ts (P3.3)
 *
 * Rate limit SMTP per-utente, basato su conteggio in DB delle email
 * inviate nell'ultima ora. È una soft cap configurabile.
 *
 * Kill-switch: rispetta `AI_USAGE_LIMITS_ENABLED`. Quando NON attivo
 * (default uso interno), la funzione restituisce sempre `allowed=true`
 * con `remaining=Infinity` — coerente con la policy in `mem://`.
 *
 * Configurazione: `app_settings` key `smtp_rate_limit_per_hour` per-utente,
 * fallback a `DEFAULT_CAP_PER_HOUR`.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const DEFAULT_CAP_PER_HOUR = 50;

export interface SmtpRateLimitResult {
  allowed: boolean;
  remaining: number;
  cap: number;
  sentLastHour: number;
}

function limitsEnabled(): boolean {
  return Deno.env.get("AI_USAGE_LIMITS_ENABLED") === "true";
}

/**
 * Verifica se l'utente può inviare un'altra email senza superare il cap orario.
 * Quando il kill-switch è OFF, ritorna sempre allowed=true (no-op).
 */
export async function checkSmtpRateLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<SmtpRateLimitResult> {
  if (!limitsEnabled()) {
    return {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      cap: Number.POSITIVE_INFINITY,
      sentLastHour: 0,
    };
  }

  // 1. Carica cap personalizzato (se presente)
  let cap = DEFAULT_CAP_PER_HOUR;
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("user_id", userId)
      .eq("key", "smtp_rate_limit_per_hour")
      .maybeSingle();
    const parsed = data?.value ? parseInt(String(data.value), 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) cap = parsed;
  } catch {
    // Fallback a default in caso di errore
  }

  // 2. Conta sent dell'ultima ora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "sent")
    .gte("created_at", oneHourAgo);

  if (error) {
    console.warn("[smtpRateLimit] count failed, allowing:", error.message);
    return { allowed: true, remaining: cap, cap, sentLastHour: 0 };
  }

  const sentLastHour = count ?? 0;
  const remaining = Math.max(0, cap - sentLastHour);
  return {
    allowed: sentLastHour < cap,
    remaining,
    cap,
    sentLastHour,
  };
}