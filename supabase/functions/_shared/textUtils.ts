/**
 * Shared text utilities — single source of truth.
 * Eliminates duplication across generate-outreach, generate-email, etc.
 */

/**
 * Language hint from country code.
 * This is a HINT for the AI, not a rigid rule — the AI can override
 * if it detects a different language from context.
 */
export function getLanguageHint(countryCode: string): { language: string; languageLabel: string } {
  const cc = (countryCode || "").toUpperCase().trim();
  const map: Record<string, { language: string; languageLabel: string }> = {
    IT: { language: "italiano", languageLabel: "Italian" },
    ES: { language: "español", languageLabel: "Spanish" },
    AR: { language: "español", languageLabel: "Spanish" },
    MX: { language: "español", languageLabel: "Spanish" },
    CO: { language: "español", languageLabel: "Spanish" },
    CL: { language: "español", languageLabel: "Spanish" },
    PE: { language: "español", languageLabel: "Spanish" },
    VE: { language: "español", languageLabel: "Spanish" },
    EC: { language: "español", languageLabel: "Spanish" },
    UY: { language: "español", languageLabel: "Spanish" },
    PY: { language: "español", languageLabel: "Spanish" },
    BO: { language: "español", languageLabel: "Spanish" },
    CR: { language: "español", languageLabel: "Spanish" },
    PA: { language: "español", languageLabel: "Spanish" },
    GT: { language: "español", languageLabel: "Spanish" },
    CU: { language: "español", languageLabel: "Spanish" },
    DO: { language: "español", languageLabel: "Spanish" },
    HN: { language: "español", languageLabel: "Spanish" },
    SV: { language: "español", languageLabel: "Spanish" },
    NI: { language: "español", languageLabel: "Spanish" },
    FR: { language: "français", languageLabel: "French" },
    BE: { language: "français", languageLabel: "French" },
    CI: { language: "français", languageLabel: "French" },
    SN: { language: "français", languageLabel: "French" },
    CM: { language: "français", languageLabel: "French" },
    MA: { language: "français", languageLabel: "French" },
    TN: { language: "français", languageLabel: "French" },
    DZ: { language: "français", languageLabel: "French" },
    DE: { language: "deutsch", languageLabel: "German" },
    AT: { language: "deutsch", languageLabel: "German" },
    CH: { language: "deutsch", languageLabel: "German" },
    PT: { language: "português", languageLabel: "Portuguese" },
    BR: { language: "português", languageLabel: "Portuguese" },
    AO: { language: "português", languageLabel: "Portuguese" },
    MZ: { language: "português", languageLabel: "Portuguese" },
    NL: { language: "nederlands", languageLabel: "Dutch" },
    RU: { language: "русский", languageLabel: "Russian" },
    TR: { language: "türkçe", languageLabel: "Turkish" },
    PL: { language: "polski", languageLabel: "Polish" },
    RO: { language: "română", languageLabel: "Romanian" },
    GR: { language: "ελληνικά", languageLabel: "Greek" },
  };
  return map[cc] || { language: "english", languageLabel: "English" };
}

/**
 * Check if a string looks like a person's name (vs a job title/department).
 * Heuristic — not perfect, but fast and good enough for salutation decisions.
 */
export function isLikelyPersonName(value: string): boolean {
  if (!value || value.trim().length < 2) return false;
  const lower = value.toLowerCase().trim();
  const roleKeywords = [
    "department", "pricing", "business development", "manager", "director",
    "office", "logistics", "operations", "commercial", "sales", "admin",
    "accounting", "hr", "human resources", "finance", "marketing",
    "customer service", "general", "managing", "executive", "officer",
    "coordinator", "supervisor", "assistant", "secretary", "reception",
    "procurement", "purchasing", "supply chain", "warehouse", "import",
    "export", "freight", "shipping", "forwarding", "trade", "compliance",
    "legal", "it ", "information technology", "support", "helpdesk",
    "division", "unit", "team", "group", "section", "bureau", "desk",
    "rappresentante", "responsabile", "direttore", "ufficio", "reparto",
    "amministrazione", "commerciale", "operativo", "logistica",
    "contabilità", "segreteria", "acquisti", "vendite",
  ];
  if (roleKeywords.some((kw) => lower.includes(kw))) return false;
  if (/[&\/]/.test(value)) return false;
  if (/^[A-Z]{2,4}(\s+[A-Z]{2,4})*$/.test(value.trim())) return false;
  return true;
}

/**
 * Strip common legal suffixes from company names.
 */
export function cleanCompanyName(name: string): string {
  if (!name) return name;
  return name
    .replace(/\b(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?a\.?s\.?|s\.?n\.?c\.?|llc|ltd\.?|inc\.?|gmbh|d\.?o\.?o\.?|corp\.?|pty\.?|plc\.?|co\.?\s*ltd\.?|pvt\.?\s*ltd\.?|s\.?a\.?|ag|ab|as|aps|bv|nv|oy|kft|sro|spol|eirl|sarl|sas|eurl|sl|sa de cv)\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
