/**
 * emailSendingConfig.ts — Modulo unificato per configurazione invio email (LOVABLE-87).
 *
 * Centralizza:
 * 1. Caricamento SMTP config (da app_settings)
 * 2. Rate limiting configurabile
 * 3. Time gate (orari di invio consentiti)
 * 4. Validazione pre-invio comune a tutti i path
 *
 * Usato da: send-email, process-email-queue, agent-execute, cadence-engine, pending-action-executor
 */

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  senderEmail: string;
  senderName: string;
  signatureImageUrl: string;
  footerImageUrl: string;
  /** TLS mode derivato dal porto */
  tlsMode: "starttls" | "implicit" | "none";
}

export interface RateLimitConfig {
  /** Max email/giorno per utente */
  maxPerDay: number;
  /** Max email/ora per utente */
  maxPerHour: number;
  /** Delay minimo tra invii consecutivi (ms) */
  minDelayMs: number;
}

export interface TimeGateConfig {
  /** Ora locale di inizio invio (0-23, default 8) */
  startHour: number;
  /** Ora locale di fine invio (0-23, default 19) */
  endHour: number;
  /** Blocca invio nei weekend (default true) */
  blockWeekends: boolean;
  /** Timezone per il calcolo (default "Europe/Rome") */
  timezone: string;
}

export interface SendingConfig {
  smtp: SmtpConfig;
  rateLimit: RateLimitConfig;
  timeGate: TimeGateConfig;
}

export interface SendingValidation {
  allowed: boolean;
  reason?: string;
  /** Se non allowed, suggerisce quando riprovare */
  retryAfter?: Date;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const SMTP_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_password",
  "default_sender_email",
  "default_sender_name",
  "ai_signature_image_url",
  "ai_footer_image_url",
] as const;

const RATE_LIMIT_KEYS = [
  "email_max_per_day",
  "email_max_per_hour",
  "email_min_delay_ms",
] as const;

const TIME_GATE_KEYS = [
  "email_send_start_hour",
  "email_send_end_hour",
  "email_block_weekends",
  "email_timezone",
] as const;

/**
 * Carica la configurazione invio completa per un utente.
 * Un'unica query a app_settings per tutti i parametri.
 */
export async function loadSendingConfig(
  supabase: SupabaseClient,
  userId: string,
): Promise<SendingConfig> {
  const allKeys = [...SMTP_KEYS, ...RATE_LIMIT_KEYS, ...TIME_GATE_KEYS];

  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId)
    .in("key", allKeys);

  const map = new Map<string, string>(
    (settings || []).map((s: { key: string; value: string | null }) => [
      s.key,
      s.value || "",
    ]),
  );

  const get = (k: string, fallback: string): string => {
    const v = map.get(k);
    return v && v.trim().length > 0 ? v : fallback;
  };
  const getInt = (k: string, fallback: number): number => {
    const v = map.get(k);
    return v && v.trim().length > 0 ? parseInt(v, 10) || fallback : fallback;
  };

  const smtpPort = getInt("smtp_port", 465);

  return {
    smtp: {
      host: get("smtp_host", ""),
      port: smtpPort,
      user: get("smtp_user", ""),
      password: get("smtp_password", ""),
      senderEmail: get("default_sender_email", get("smtp_user", "")),
      senderName: get("default_sender_name", ""),
      signatureImageUrl: get("ai_signature_image_url", ""),
      footerImageUrl: get("ai_footer_image_url", ""),
      tlsMode:
        smtpPort === 587
          ? "starttls"
          : smtpPort === 465
          ? "implicit"
          : "none",
    },
    rateLimit: {
      maxPerDay: getInt("email_max_per_day", 200),
      maxPerHour: getInt("email_max_per_hour", 50),
      minDelayMs: getInt("email_min_delay_ms", 2000),
    },
    timeGate: {
      startHour: getInt("email_send_start_hour", 8),
      endHour: getInt("email_send_end_hour", 19),
      blockWeekends: get("email_block_weekends", "true") === "true",
      timezone: get("email_timezone", "Europe/Rome"),
    },
  };
}

/**
 * Valida se l'invio è permesso in questo momento dato il rate limit e il time gate.
 * Controlla: time gate, rate limit giornaliero, rate limit orario.
 */
export async function validateSendingWindow(
  supabase: SupabaseClient,
  userId: string,
  config: SendingConfig,
): Promise<SendingValidation> {
  // 1. Time gate
  const timeCheck = checkTimeGate(config.timeGate);
  if (!timeCheck.allowed) return timeCheck;

  // 2. Rate limit giornaliero
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: dailyCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("activity_type", "send_email")
    .gte("created_at", todayStart.toISOString());

  if ((dailyCount ?? 0) >= config.rateLimit.maxPerDay) {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(config.timeGate.startHour, 0, 0, 0);
    return {
      allowed: false,
      reason: `Limite giornaliero raggiunto (${dailyCount}/${config.rateLimit.maxPerDay}). Riprova domani.`,
      retryAfter: tomorrow,
    };
  }

  // 3. Rate limit orario
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count: hourlyCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("activity_type", "send_email")
    .gte("created_at", oneHourAgo);

  if ((hourlyCount ?? 0) >= config.rateLimit.maxPerHour) {
    return {
      allowed: false,
      reason: `Limite orario raggiunto (${hourlyCount}/${config.rateLimit.maxPerHour}). Attendi qualche minuto.`,
      retryAfter: new Date(Date.now() + 600000), // +10min suggerimento
    };
  }

  return { allowed: true };
}

/**
 * Controlla il time gate senza interrogare il DB.
 * Utile per check rapidi prima di avviare pipeline costose.
 */
export function checkTimeGate(gate: TimeGateConfig): SendingValidation {
  const now = new Date();

  // Calcola ora locale approssimativa (senza libreria TZ pesante)
  // Per Deno: usiamo Intl.DateTimeFormat per l'ora locale
  let localHour: number;
  let localDay: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: gate.timezone,
      hour: "numeric",
      hour12: false,
    });
    localHour = parseInt(formatter.format(now), 10);

    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: gate.timezone,
      weekday: "short",
    });
    const dayStr = dayFormatter.format(now);
    localDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayStr);
  } catch {
    // Fallback: usa UTC
    localHour = now.getUTCHours();
    localDay = now.getUTCDay();
  }

  if (gate.blockWeekends && (localDay === 0 || localDay === 6)) {
    // Calcola prossimo lunedì
    const daysUntilMonday = localDay === 0 ? 1 : 2;
    const nextMonday = new Date(now);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(gate.startHour, 0, 0, 0);
    return {
      allowed: false,
      reason: `Invio bloccato nei weekend. Riprende lunedì alle ${gate.startHour}:00.`,
      retryAfter: nextMonday,
    };
  }

  if (localHour < gate.startHour || localHour >= gate.endHour) {
    const retryAfter = new Date(now);
    if (localHour >= gate.endHour) {
      retryAfter.setDate(retryAfter.getDate() + 1);
    }
    retryAfter.setHours(gate.startHour, 0, 0, 0);
    return {
      allowed: false,
      reason: `Fuori orario invio (${gate.startHour}:00-${gate.endHour}:00, ora locale ${localHour}:00).`,
      retryAfter,
    };
  }

  return { allowed: true };
}

/**
 * Controlla SMTP config è completa e valida.
 */
export function validateSmtpConfig(
  smtp: SmtpConfig,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!smtp.host) errors.push("SMTP host non configurato");
  if (!smtp.user) errors.push("SMTP user non configurato");
  if (!smtp.password) errors.push("SMTP password non configurata");
  if (!smtp.senderEmail) errors.push("Email mittente non configurata");
  return { valid: errors.length === 0, errors };
}
