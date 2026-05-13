/**
 * languages.ts — Catalogo lingue + risoluzione "auto" (lingua del contatto).
 *
 * Filosofia operativa (Codex):
 *   - Italiano è il default storico.
 *   - Inglese è il fallback sicuro: se non sappiamo CON CERTEZZA la lingua del
 *     destinatario (paese sconosciuto, paese multilingue ambiguo, business hub
 *     internazionale), si va in inglese senza paura.
 *   - Si usa la lingua locale solo quando il country code è "forte" (paese
 *     monolinguistico o lingua dominante chiara).
 *
 * Lato server, la stessa logica vive in `_shared/languageDetector.ts`:
 *   teniamo le due fonti il più allineate possibile, ma il server resta
 *   l'autorità — qui esponiamo solo l'UX di selezione.
 */

export interface LanguageEntry {
  /** Etichetta italiana usata nei prompt (es. "italiano", "inglese", "tedesco"). */
  readonly key: string;
  /** ISO 639-1 lowercase. */
  readonly iso: string;
  /** Etichetta italiana mostrata in UI. */
  readonly labelIt: string;
  /** Endonym (lingua nella lingua stessa). */
  readonly native: string;
  /** Bandiera emoji rappresentativa (paese principale). */
  readonly flag: string;
}

/**
 * Lista lingue ISO 639-1 — copertura mondiale ragionevole (~80 lingue parlate
 * dalla quasi totalità dei contatti business). Espandibile senza side-effect.
 */
export const LANGUAGES: ReadonlyArray<LanguageEntry> = [
  { key: "italiano",   iso: "it", labelIt: "Italiano",     native: "Italiano",      flag: "🇮🇹" },
  { key: "inglese",    iso: "en", labelIt: "Inglese",      native: "English",        flag: "🇬🇧" },
  { key: "francese",   iso: "fr", labelIt: "Francese",     native: "Français",       flag: "🇫🇷" },
  { key: "tedesco",    iso: "de", labelIt: "Tedesco",      native: "Deutsch",        flag: "🇩🇪" },
  { key: "spagnolo",   iso: "es", labelIt: "Spagnolo",     native: "Español",        flag: "🇪🇸" },
  { key: "portoghese", iso: "pt", labelIt: "Portoghese",   native: "Português",      flag: "🇵🇹" },
  { key: "olandese",   iso: "nl", labelIt: "Olandese",     native: "Nederlands",     flag: "🇳🇱" },
  { key: "svedese",    iso: "sv", labelIt: "Svedese",      native: "Svenska",        flag: "🇸🇪" },
  { key: "norvegese",  iso: "no", labelIt: "Norvegese",    native: "Norsk",          flag: "🇳🇴" },
  { key: "danese",     iso: "da", labelIt: "Danese",       native: "Dansk",          flag: "🇩🇰" },
  { key: "finlandese", iso: "fi", labelIt: "Finlandese",   native: "Suomi",          flag: "🇫🇮" },
  { key: "polacco",    iso: "pl", labelIt: "Polacco",      native: "Polski",         flag: "🇵🇱" },
  { key: "ceco",       iso: "cs", labelIt: "Ceco",         native: "Čeština",        flag: "🇨🇿" },
  { key: "slovacco",   iso: "sk", labelIt: "Slovacco",     native: "Slovenčina",     flag: "🇸🇰" },
  { key: "ungherese",  iso: "hu", labelIt: "Ungherese",    native: "Magyar",         flag: "🇭🇺" },
  { key: "rumeno",     iso: "ro", labelIt: "Rumeno",       native: "Română",         flag: "🇷🇴" },
  { key: "bulgaro",    iso: "bg", labelIt: "Bulgaro",      native: "Български",       flag: "🇧🇬" },
  { key: "greco",      iso: "el", labelIt: "Greco",        native: "Ελληνικά",       flag: "🇬🇷" },
  { key: "croato",     iso: "hr", labelIt: "Croato",       native: "Hrvatski",       flag: "🇭🇷" },
  { key: "serbo",      iso: "sr", labelIt: "Serbo",        native: "Srpski",         flag: "🇷🇸" },
  { key: "sloveno",    iso: "sl", labelIt: "Sloveno",      native: "Slovenščina",    flag: "🇸🇮" },
  { key: "lituano",    iso: "lt", labelIt: "Lituano",      native: "Lietuvių",       flag: "🇱🇹" },
  { key: "lettone",    iso: "lv", labelIt: "Lettone",      native: "Latviešu",       flag: "🇱🇻" },
  { key: "estone",     iso: "et", labelIt: "Estone",       native: "Eesti",          flag: "🇪🇪" },
  { key: "ucraino",    iso: "uk", labelIt: "Ucraino",      native: "Українська",     flag: "🇺🇦" },
  { key: "russo",      iso: "ru", labelIt: "Russo",        native: "Русский",         flag: "🇷🇺" },
  { key: "turco",      iso: "tr", labelIt: "Turco",        native: "Türkçe",         flag: "🇹🇷" },
  { key: "arabo",      iso: "ar", labelIt: "Arabo",        native: "العربية",        flag: "🇸🇦" },
  { key: "ebraico",    iso: "he", labelIt: "Ebraico",      native: "עברית",          flag: "🇮🇱" },
  { key: "persiano",   iso: "fa", labelIt: "Persiano",     native: "فارسی",          flag: "🇮🇷" },
  { key: "hindi",      iso: "hi", labelIt: "Hindi",        native: "हिन्दी",          flag: "🇮🇳" },
  { key: "bengalese",  iso: "bn", labelIt: "Bengalese",    native: "বাংলা",          flag: "🇧🇩" },
  { key: "urdu",       iso: "ur", labelIt: "Urdu",         native: "اردو",           flag: "🇵🇰" },
  { key: "tamil",      iso: "ta", labelIt: "Tamil",        native: "தமிழ்",          flag: "🇮🇳" },
  { key: "cinese",     iso: "zh", labelIt: "Cinese",       native: "中文",           flag: "🇨🇳" },
  { key: "giapponese", iso: "ja", labelIt: "Giapponese",   native: "日本語",          flag: "🇯🇵" },
  { key: "coreano",    iso: "ko", labelIt: "Coreano",      native: "한국어",          flag: "🇰🇷" },
  { key: "thailandese",iso: "th", labelIt: "Thailandese",  native: "ไทย",            flag: "🇹🇭" },
  { key: "vietnamita", iso: "vi", labelIt: "Vietnamita",   native: "Tiếng Việt",     flag: "🇻🇳" },
  { key: "indonesiano",iso: "id", labelIt: "Indonesiano",  native: "Bahasa Indonesia", flag: "🇮🇩" },
  { key: "malese",     iso: "ms", labelIt: "Malese",       native: "Bahasa Melayu",  flag: "🇲🇾" },
  { key: "filippino",  iso: "tl", labelIt: "Filippino",    native: "Filipino",       flag: "🇵🇭" },
  { key: "swahili",    iso: "sw", labelIt: "Swahili",      native: "Kiswahili",      flag: "🇰🇪" },
  { key: "afrikaans",  iso: "af", labelIt: "Afrikaans",    native: "Afrikaans",      flag: "🇿🇦" },
  { key: "albanese",   iso: "sq", labelIt: "Albanese",     native: "Shqip",          flag: "🇦🇱" },
  { key: "armeno",     iso: "hy", labelIt: "Armeno",       native: "Հայերեն",        flag: "🇦🇲" },
  { key: "azero",      iso: "az", labelIt: "Azero",        native: "Azərbaycan",     flag: "🇦🇿" },
  { key: "bielorusso", iso: "be", labelIt: "Bielorusso",   native: "Беларуская",      flag: "🇧🇾" },
  { key: "georgiano",  iso: "ka", labelIt: "Georgiano",    native: "ქართული",         flag: "🇬🇪" },
  { key: "islandese",  iso: "is", labelIt: "Islandese",    native: "Íslenska",       flag: "🇮🇸" },
  { key: "irlandese",  iso: "ga", labelIt: "Irlandese",    native: "Gaeilge",        flag: "🇮🇪" },
  { key: "macedone",   iso: "mk", labelIt: "Macedone",     native: "Македонски",      flag: "🇲🇰" },
  { key: "maltese",    iso: "mt", labelIt: "Maltese",      native: "Malti",          flag: "🇲🇹" },
  { key: "mongolo",    iso: "mn", labelIt: "Mongolo",      native: "Монгол",          flag: "🇲🇳" },
  { key: "khmer",      iso: "km", labelIt: "Khmer",        native: "ខ្មែរ",          flag: "🇰🇭" },
  { key: "lao",        iso: "lo", labelIt: "Lao",          native: "ລາວ",            flag: "🇱🇦" },
  { key: "birmano",    iso: "my", labelIt: "Birmano",      native: "မြန်မာ",          flag: "🇲🇲" },
  { key: "nepalese",   iso: "ne", labelIt: "Nepalese",     native: "नेपाली",          flag: "🇳🇵" },
  { key: "singalese",  iso: "si", labelIt: "Singalese",    native: "සිංහල",          flag: "🇱🇰" },
  { key: "amarico",    iso: "am", labelIt: "Amarico",      native: "አማርኛ",           flag: "🇪🇹" },
  { key: "catalano",   iso: "ca", labelIt: "Catalano",     native: "Català",         flag: "🇪🇸" },
  { key: "basco",      iso: "eu", labelIt: "Basco",        native: "Euskara",        flag: "🇪🇸" },
  { key: "gallego",    iso: "gl", labelIt: "Gallego",      native: "Galego",         flag: "🇪🇸" },
];

/**
 * Mappa countryCode → key lingua dominante. Solo paesi dove la lingua è
 * "forte" (>~80% popolazione business). Paesi multilingue ambigui (BE, CH,
 * CA, IN, ZA, …) restano fuori — vanno in fallback inglese.
 */
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  IT: "italiano", SM: "italiano", VA: "italiano",
  GB: "inglese", US: "inglese", AU: "inglese", NZ: "inglese", IE: "inglese",
  FR: "francese", MC: "francese", LU: "francese",
  DE: "tedesco", AT: "tedesco", LI: "tedesco",
  ES: "spagnolo", MX: "spagnolo", AR: "spagnolo", CL: "spagnolo", CO: "spagnolo",
  PE: "spagnolo", VE: "spagnolo", UY: "spagnolo", EC: "spagnolo", CR: "spagnolo",
  PT: "portoghese", BR: "portoghese", AO: "portoghese", MZ: "portoghese",
  NL: "olandese",
  SE: "svedese",
  NO: "norvegese",
  DK: "danese",
  FI: "finlandese",
  PL: "polacco",
  CZ: "ceco",
  SK: "slovacco",
  HU: "ungherese",
  RO: "rumeno", MD: "rumeno",
  BG: "bulgaro",
  GR: "greco", CY: "greco",
  HR: "croato",
  RS: "serbo",
  SI: "sloveno",
  LT: "lituano",
  LV: "lettone",
  EE: "estone",
  UA: "ucraino",
  RU: "russo", BY: "russo", KZ: "russo",
  TR: "turco",
  SA: "arabo", AE: "arabo", EG: "arabo", QA: "arabo", KW: "arabo",
  BH: "arabo", OM: "arabo", JO: "arabo", LB: "arabo", MA: "arabo",
  TN: "arabo", DZ: "arabo", LY: "arabo", IQ: "arabo", SY: "arabo", YE: "arabo",
  IL: "ebraico",
  IR: "persiano",
  CN: "cinese", TW: "cinese", HK: "cinese",
  JP: "giapponese",
  KR: "coreano",
  TH: "thailandese",
  VN: "vietnamita",
  ID: "indonesiano",
  MY: "malese",
  PH: "filippino",
  IS: "islandese",
  AL: "albanese",
  AM: "armeno",
  AZ: "azero",
  GE: "georgiano",
  MK: "macedone",
  MT: "maltese",
  MN: "mongolo",
  KH: "khmer",
  LA: "lao",
  MM: "birmano",
  NP: "nepalese",
  LK: "singalese",
  ET: "amarico",
};

/** Modalità di scelta lingua nel composer. */
export type LanguageMode =
  | { kind: "italiano" }
  | { kind: "inglese" }
  | { kind: "auto" }
  | { kind: "specific"; key: string };

export interface ResolvedLanguage {
  /** Chiave da passare al backend (campo `language` nel payload). */
  language: string;
  /** Da dove viene la scelta. */
  source: "user_choice" | "country_strong" | "fallback_english" | "default_italian";
  /** Confidence 0..1 (informativa, non blocca). */
  confidence: number;
  /** Etichetta UX in italiano. */
  label: string;
}

/**
 * Risolve la lingua effettiva da usare per la generazione/traduzione.
 *
 * Regole:
 *   - kind=italiano → italiano (confidence 1).
 *   - kind=inglese → inglese (confidence 1).
 *   - kind=specific → la lingua scelta (confidence 1).
 *   - kind=auto:
 *       - countryCode mappato in COUNTRY_TO_LANGUAGE → quella lingua (0.9).
 *       - altrimenti inglese, source=fallback_english (0.6).
 */
export function resolveLanguage(
  mode: LanguageMode,
  context: { countryCode?: string | null; countryName?: string | null } = {},
): ResolvedLanguage {
  if (mode.kind === "italiano") {
    return { language: "italiano", source: "user_choice", confidence: 1, label: "Italiano" };
  }
  if (mode.kind === "inglese") {
    return { language: "inglese", source: "user_choice", confidence: 1, label: "Inglese" };
  }
  if (mode.kind === "specific") {
    const entry = LANGUAGES.find((l) => l.key === mode.key);
    return {
      language: mode.key,
      source: "user_choice",
      confidence: 1,
      label: entry ? entry.labelIt : mode.key,
    };
  }
  // auto
  const cc = (context.countryCode || "").toUpperCase().trim();
  if (cc && COUNTRY_TO_LANGUAGE[cc]) {
    const lang = COUNTRY_TO_LANGUAGE[cc];
    const entry = LANGUAGES.find((l) => l.key === lang);
    return {
      language: lang,
      source: "country_strong",
      confidence: 0.9,
      label: entry ? `${entry.labelIt} (${cc})` : `${lang} (${cc})`,
    };
  }
  return {
    language: "inglese",
    source: "fallback_english",
    confidence: 0.6,
    label: cc ? `Inglese (paese ${cc} ambiguo)` : "Inglese (paese sconosciuto)",
  };
}

/** Storage key per persistere la scelta operatore tra sessioni. */
export const LANGUAGE_MODE_STORAGE_KEY = "email.languageMode.v1";

export function loadLanguageModeFromStorage(): LanguageMode {
  if (typeof window === "undefined") return { kind: "italiano" };
  try {
    const raw = window.localStorage.getItem(LANGUAGE_MODE_STORAGE_KEY);
    if (!raw) return { kind: "italiano" };
    const parsed = JSON.parse(raw) as LanguageMode;
    if (parsed && typeof parsed === "object" && "kind" in parsed) return parsed;
  } catch {
    /* ignore */
  }
  return { kind: "italiano" };
}

export function saveLanguageModeToStorage(mode: LanguageMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_MODE_STORAGE_KEY, JSON.stringify(mode));
  } catch {
    /* ignore */
  }
}