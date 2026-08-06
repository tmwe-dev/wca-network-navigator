import type { DetectedTone } from "../../lib/toneDetector";

export function extractPersonAndCompany(prompt: string): {
  person: string | null;
  company: string | null;
  email: string | null;
} {
  const emailMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const email = emailMatch ? emailMatch[0] : null;

  const re =
    /\ba\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,3})\s+(?:di|della|del|dello|dalla|presso)\s+(?:la\s+|il\s+|lo\s+)?([A-ZÀ-Ý][\w\sÀ-ÿ'&.-]{2,60}?)(?:\s+(?:di|in|a)\s+[A-ZÀ-Ý]|[,.\n]|$)/i;
  const m = prompt.match(re);
  let person: string | null = null;
  let company: string | null = null;
  if (m) {
    person = m[1].trim();
    company = m[2]
      .trim()
      .replace(/\s+(e|ed)\s+invitalo.*$/i, "")
      .trim();
  } else {
    const cm = prompt.match(
      /\b(?:di|della|del)\s+(?:la\s+|il\s+)?([A-ZÀ-Ý][\w\sÀ-ÿ'&.-]{2,60}?)(?:\s+(?:di|in|a)\s+[A-ZÀ-Ý]|[,.\n]|$)/,
    );
    if (cm) company = cm[1].trim();
    const pm = prompt.match(/\ba\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,2})\b/);
    if (pm) person = pm[1].trim();
  }
  return { person, company, email };
}

const COUNTRY_MAP: Record<string, string> = {
  malta: "MT",
  italia: "IT",
  italy: "IT",
  francia: "FR",
  france: "FR",
  spagna: "ES",
  spain: "ES",
  germania: "DE",
  germany: "DE",
  "regno unito": "GB",
  uk: "GB",
  "united kingdom": "GB",
  inghilterra: "GB",
  olanda: "NL",
  "paesi bassi": "NL",
  netherlands: "NL",
  belgio: "BE",
  belgium: "BE",
  portogallo: "PT",
  portugal: "PT",
  grecia: "GR",
  greece: "GR",
  svizzera: "CH",
  switzerland: "CH",
  austria: "AT",
  polonia: "PL",
  poland: "PL",
  romania: "RO",
  turchia: "TR",
  turkey: "TR",
  "stati uniti": "US",
  usa: "US",
  "united states": "US",
  america: "US",
  canada: "CA",
  messico: "MX",
  mexico: "MX",
  brasile: "BR",
  brazil: "BR",
  argentina: "AR",
  cile: "CL",
  chile: "CL",
  venezuela: "VE",
  cina: "CN",
  china: "CN",
  giappone: "JP",
  japan: "JP",
  india: "IN",
  emirati: "AE",
  uae: "AE",
  "arabia saudita": "SA",
  egitto: "EG",
  egypt: "EG",
  marocco: "MA",
  morocco: "MA",
  "sud africa": "ZA",
  "south africa": "ZA",
  australia: "AU",
  "nuova zelanda": "NZ",
  "new zealand": "NZ",
  singapore: "SG",
  "hong kong": "HK",
  thailandia: "TH",
  thailand: "TH",
  vietnam: "VN",
  indonesia: "ID",
  malesia: "MY",
  malaysia: "MY",
  filippine: "PH",
  philippines: "PH",
  korea: "KR",
  "corea del sud": "KR",
};

export function detectCountryCode(prompt: string): { code: string; label: string } | null {
  const lower = prompt.toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    const re = new RegExp(`\\b(?:di|in|a|da|of|from|to)\\s+${name}\\b`, "i");
    if (re.test(lower)) return { code, label: name };
  }
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(lower)) return { code, label: name };
  }
  return null;
}

/**
 * Recupera il paese di lavoro dalla conversazione recente quando il prompt
 * corrente non lo nomina esplicitamente (es. "preparane una per uno dei tanti").
 * Scansiona gli ultimi turni dal più recente al più vecchio.
 */
export function detectCountryFromHistory(
  history: ReadonlyArray<{ role: string; content: string }> | undefined,
): { code: string; label: string } | null {
  if (!history || history.length === 0) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (!turn?.content) continue;
    const hit = detectCountryCode(turn.content);
    if (hit) return hit;
  }
  return null;
}

/** True se l'utente chiede un singolo esempio ("per uno", "uno dei tanti"). */
export function isSingleSampleIntent(prompt: string): boolean {
  const p = (prompt ?? "").toLowerCase();
  return /\b(per\s+uno|uno\s+dei|uno\s+di\s+loro|un\s+partner|una\s+sola|un\s+esempio|di\s+esempio|un'?\s*email\s+per\s+uno)\b/i.test(
    p,
  );
}

export function isCountryWideIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /\b(tutti\s+i\s+(?:nostri\s+)?partner|(?:ai|per\s+(?:i|gli)|i|gli)\s+(?:nostri\s+)?partner\s+(?:a|in|di|del|della|dello|dei|degli)\s+\w+|ai\s+(?:nostri\s+)?partner|ai\s+responsabili|partner\s+di\s+\w+)\b/i.test(
    lower,
  );
}

/** True se il prompt è un invito/azione generica senza identificazione esplicita
 *  di azienda+persona (es. "prepara un invito a venire a Milano"). */
export function looksLikeGenericInvite(prompt: string): boolean {
  const p = (prompt ?? "").toLowerCase();
  if (
    !/\b(invito|invita|invitarli|ospiti|venire|partita|evento|magazzin|presentazione|cena|workshop|meeting)\b/i.test(p)
  ) {
    return false;
  }
  if (
    /\ba\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,3}\s+(?:di|della|del|dello|dalla|presso)\s+[A-ZÀ-Ý]/i.test(
      prompt,
    )
  ) {
    return false;
  }
  return true;
}

/** Estrae il testo naturale da un prompt che può essere JSON serializzato
 *  (planRunner) o testo libero. Se context.originalPrompt esiste, vince. */
export function resolveNaturalPrompt(prompt: string, context?: { originalPrompt?: string }): string {
  const orig = (context?.originalPrompt ?? "").trim();
  if (orig.length > 0) return orig;
  const trimmed = (prompt ?? "").trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const hint =
        (obj.prompt as string) ?? (obj.goal as string) ?? (obj.message as string) ?? (obj.text as string) ?? "";
      if (typeof hint === "string" && hint.length > 0) return hint;
    } catch {
      /* keep raw */
    }
  }
  return prompt;
}

export function extractPartnersFromContextPayload(payload: Record<string, unknown> | undefined): {
  countryCode: string | null;
  partnerIds: string[];
} {
  if (!payload) return { countryCode: null, partnerIds: [] };
  const partnerIdsRaw = payload.partner_ids ?? payload.partnerIds ?? payload.ids;
  const partnerIds = Array.isArray(partnerIdsRaw)
    ? partnerIdsRaw.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  const countryRaw = payload.country_code ?? payload.countryCode;
  return {
    countryCode: typeof countryRaw === "string" && countryRaw.length > 0 ? countryRaw : null,
    partnerIds,
  };
}

export function leadStatusNote(s: string | null): string {
  if (!s) return "Lead status: non impostato";
  const map: Record<string, string> = {
    new: "Lead nuovo, mai contattato",
    contacted: "Già contattato in precedenza",
    qualified: "Lead qualificato",
    holding: "⚠️ In circuito d'attesa — verificare prima di rinviare",
    archived: "⚠️ Archiviato — invio sconsigliato",
    blacklisted: "⛔ In blacklist — invio bloccato",
    customer: "Cliente attivo",
  };
  return map[s] ?? `Lead status: ${s}`;
}

export function daysSince(iso: string | null): string {
  if (!iso) return "mai";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "oggi";
  if (d === 1) return "ieri";
  return `${d} giorni fa`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * PROMPT FREEDOM — Parametri semantici risolti dall'AI (planner).
 *
 * Filosofia: l'AI interpreta il linguaggio naturale e produce parametri
 * strutturati. Il codice NON ridecodifica l'intento con regex: legge i
 * parametri e applica solo le guardrail (cosa il tool NON può fare).
 * Le regex restano come fallback di sicurezza quando il planner non passa
 * parametri semantici (retro-compatibilità).
 * ────────────────────────────────────────────────────────────────────────── */

export interface ComposeParams {
  /** "single" = un destinatario / un esempio · "batch" = molti partner */
  scope: "single" | "batch" | null;
  countryCode: string | null;
  countryLabel: string | null;
  company: string | null;
  person: string | null;
  email: string | null;
  /** Obiettivo del messaggio in linguaggio naturale (per generate-email). */
  intent: string | null;
  tone: DetectedTone | null;
  /** True se almeno un destinatario è identificabile dai parametri. */
  hasRecipient: boolean;
  /** True se il planner ha passato almeno un parametro semantico. */
  hasAny: boolean;
}

/** Converte un nome paese (o codice ISO2) in { code, label }. */
export function countryFromName(raw: string | null | undefined): { code: string; label: string } | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) {
    const code = s.toUpperCase();
    const label = Object.entries(COUNTRY_MAP).find(([, c]) => c === code)?.[0] ?? code;
    return { code, label };
  }
  const direct = COUNTRY_MAP[s.toLowerCase()];
  if (direct) return { code: direct, label: s.toLowerCase() };
  return detectCountryCode(s);
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function asTone(v: unknown): DetectedTone | null {
  return v === "amichevole" || v === "professionale" || v === "diretto" || v === "informale" ? v : null;
}

/**
 * Legge i parametri semantici prodotti dall'AI (planner) dal payload del tool.
 * Se il paese non è esplicito ma serve, lo recupera dalla conversazione.
 */
export function readComposeParams(
  payload: Record<string, unknown> | undefined,
  history?: ReadonlyArray<{ role: string; content: string }>,
): ComposeParams {
  const p = payload ?? {};
  const scopeRaw = asStr(p.recipientScope ?? p.scope ?? p.mode);
  const scope: "single" | "batch" | null = scopeRaw === "single" || scopeRaw === "batch" ? scopeRaw : null;

  const email = asStr(p.email ?? p.recipientEmail);
  const company = asStr(p.company ?? p.recipientCompany ?? p.companyName);
  const person = asStr(p.person ?? p.recipientPerson ?? p.contactName ?? p.recipientName);
  const intent = asStr(p.intent ?? p.goal ?? p.message);
  const tone = asTone(p.tone);

  const countryRaw = asStr(p.countryName ?? p.country ?? p.countryCode ?? p.countryLabel);
  let country = countryFromName(countryRaw);
  if (!country && !email && !company) {
    // Nessun destinatario esplicito: prova a dedurre il paese dalla chat.
    country = detectCountryFromHistory(history);
  }

  const hasRecipient = !!(email || company || country);
  const hasAny = hasRecipient || !!intent || scope != null;

  return {
    scope,
    countryCode: country?.code ?? null,
    countryLabel: country?.label ?? null,
    company,
    person,
    email,
    intent,
    tone,
    hasRecipient,
    hasAny,
  };
}
