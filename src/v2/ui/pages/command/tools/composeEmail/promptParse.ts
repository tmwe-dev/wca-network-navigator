export function extractPersonAndCompany(prompt: string): { person: string | null; company: string | null; email: string | null } {
  const emailMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const email = emailMatch ? emailMatch[0] : null;

  const re = /\ba\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,3})\s+(?:di|della|del|dello|dalla|presso)\s+(?:la\s+|il\s+|lo\s+)?([A-ZÀ-Ý][\w\sÀ-ÿ'&.-]{2,60}?)(?:\s+(?:di|in|a)\s+[A-ZÀ-Ý]|[,.\n]|$)/i;
  const m = prompt.match(re);
  let person: string | null = null;
  let company: string | null = null;
  if (m) {
    person = m[1].trim();
    company = m[2].trim().replace(/\s+(e|ed)\s+invitalo.*$/i, "").trim();
  } else {
    const cm = prompt.match(/\b(?:di|della|del)\s+(?:la\s+|il\s+)?([A-ZÀ-Ý][\w\sÀ-ÿ'&.-]{2,60}?)(?:\s+(?:di|in|a)\s+[A-ZÀ-Ý]|[,.\n]|$)/);
    if (cm) company = cm[1].trim();
    const pm = prompt.match(/\ba\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,2})\b/);
    if (pm) person = pm[1].trim();
  }
  return { person, company, email };
}

const COUNTRY_MAP: Record<string, string> = {
  malta: "MT", italia: "IT", italy: "IT", francia: "FR", france: "FR",
  spagna: "ES", spain: "ES", germania: "DE", germany: "DE",
  "regno unito": "GB", uk: "GB", "united kingdom": "GB", inghilterra: "GB",
  olanda: "NL", "paesi bassi": "NL", netherlands: "NL", belgio: "BE", belgium: "BE",
  portogallo: "PT", portugal: "PT", grecia: "GR", greece: "GR",
  svizzera: "CH", switzerland: "CH", austria: "AT",
  polonia: "PL", poland: "PL", romania: "RO", turchia: "TR", turkey: "TR",
  "stati uniti": "US", usa: "US", "united states": "US", america: "US",
  canada: "CA", messico: "MX", mexico: "MX", brasile: "BR", brazil: "BR",
  argentina: "AR", cile: "CL", chile: "CL", venezuela: "VE",
  cina: "CN", china: "CN", giappone: "JP", japan: "JP", india: "IN",
  emirati: "AE", uae: "AE", "arabia saudita": "SA", egitto: "EG", egypt: "EG",
  marocco: "MA", morocco: "MA", "sud africa": "ZA", "south africa": "ZA",
  australia: "AU", "nuova zelanda": "NZ", "new zealand": "NZ",
  singapore: "SG", "hong kong": "HK", thailandia: "TH", thailand: "TH",
  vietnam: "VN", indonesia: "ID", malesia: "MY", malaysia: "MY",
  filippine: "PH", philippines: "PH", korea: "KR", "corea del sud": "KR",
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

export function isCountryWideIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /\b(tutti\s+i\s+(?:nostri\s+)?partner|(?:ai|per\s+(?:i|gli)|i|gli)\s+(?:nostri\s+)?partner\s+(?:a|in|di|del|della|dello|dei|degli)\s+\w+|ai\s+(?:nostri\s+)?partner|ai\s+responsabili|partner\s+di\s+\w+)\b/i.test(lower);
}

/** True se il prompt è un invito/azione generica senza identificazione esplicita
 *  di azienda+persona (es. "prepara un invito a venire a Milano"). */
export function looksLikeGenericInvite(prompt: string): boolean {
  const p = (prompt ?? "").toLowerCase();
  if (!/\b(invito|invita|invitarli|ospiti|venire|partita|evento|magazzin|presentazione|cena|workshop|meeting)\b/i.test(p)) {
    return false;
  }
  if (/\ba\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,3}\s+(?:di|della|del|dello|dalla|presso)\s+[A-ZÀ-Ý]/i.test(prompt)) {
    return false;
  }
  return true;
}

/** Estrae il testo naturale da un prompt che può essere JSON serializzato
 *  (planRunner) o testo libero. Se context.originalPrompt esiste, vince. */
export function resolveNaturalPrompt(
  prompt: string,
  context?: { originalPrompt?: string },
): string {
  const orig = (context?.originalPrompt ?? "").trim();
  if (orig.length > 0) return orig;
  const trimmed = (prompt ?? "").trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const hint =
        (obj.prompt as string) ??
        (obj.goal as string) ??
        (obj.message as string) ??
        (obj.text as string) ??
        "";
      if (typeof hint === "string" && hint.length > 0) return hint;
    } catch {
      /* keep raw */
    }
  }
  return prompt;
}

export function extractPartnersFromContextPayload(
  payload: Record<string, unknown> | undefined,
): { countryCode: string | null; partnerIds: string[] } {
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