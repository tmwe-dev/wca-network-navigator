/**
 * countryHints — utility per derivare un codice paese ISO2 quando i contatti
 * CRM non hanno il campo `country` valorizzato in modo normalizzato.
 *
 * Strategia:
 *  1. Se `country` è una stringa di 2 lettere → assumi ISO2 (uppercase).
 *  2. Se `country` è un nome esteso → cerca in `WCA_COUNTRIES_MAP` per nome
 *     (case-insensitive). Lookup O(1) su mappa precostruita.
 *  3. Se `country` è vuoto → cerca la `city` in una mappa curata di città
 *     "ovvie" (Dubai, Milano, Dallas, Hong Kong…). NON serve coprire tutto
 *     il mondo: copre i casi noti per evitare il fallback 🌐.
 *  4. Altrimenti → null (la card mostrerà uno stato neutro, niente mondino).
 */
import { WCA_COUNTRIES } from "@/data/wcaCountries";

const NAME_TO_ISO: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of WCA_COUNTRIES) m[c.name.toLowerCase()] = c.code;
  // Alias comuni / nomi non standard frequenti nei dati legacy.
  Object.assign(m, {
    "usa": "US",
    "u.s.a.": "US",
    "u.s.": "US",
    "united states of america": "US",
    "uk": "GB",
    "u.k.": "GB",
    "england": "GB",
    "scotland": "GB",
    "uae": "AE",
    "u.a.e.": "AE",
    "emirates": "AE",
    "south korea": "KR",
    "north korea": "KP",
    "russia": "RU",
    "iran": "IR",
    "syria": "SY",
    "vietnam": "VN",
    "taiwan": "TW",
    "ivory coast": "CI",
    "côte d'ivoire": "CI",
    "cote d'ivoire": "CI",
    "czechia": "CZ",
  });
  return m;
})();

const CITY_TO_ISO: Record<string, string> = {
  // Italy
  "milano": "IT", "milan": "IT", "roma": "IT", "rome": "IT",
  "torino": "IT", "turin": "IT", "napoli": "IT", "naples": "IT",
  "firenze": "IT", "florence": "IT", "bologna": "IT", "venezia": "IT",
  "venice": "IT", "genova": "IT", "genoa": "IT", "verona": "IT",
  "padova": "IT", "padua": "IT", "bergamo": "IT", "brescia": "IT",
  "trieste": "IT", "ancona": "IT", "bari": "IT", "palermo": "IT",
  "catania": "IT", "cagliari": "IT", "lainate": "IT", "buccinasco": "IT",
  "peschiera borromeo": "IT", "san giuliano milanese": "IT",
  "savignano sul rubicone": "IT", "corzano": "IT", "cambiago": "IT",
  "busto garolfo": "IT", "bagnolo mella": "IT", "azzano san paolo": "IT",
  "capolona": "IT", "capolonia": "IT",
  // UAE
  "dubai": "AE", "abu dhabi": "AE", "sharjah": "AE", "ajman": "AE",
  // USA
  "dallas": "US", "houston": "US", "miami": "US", "new york": "US",
  "los angeles": "US", "san francisco": "US", "chicago": "US",
  "atlanta": "US", "boston": "US", "seattle": "US", "denver": "US",
  "washington": "US", "philadelphia": "US", "phoenix": "US",
  "fort lauderdale": "US",
  // UK
  "london": "GB", "manchester": "GB", "birmingham": "GB",
  "liverpool": "GB", "glasgow": "GB", "edinburgh": "GB",
  // China / HK / SG / JP / KR
  "shanghai": "CN", "beijing": "CN", "guangzhou": "CN", "shenzhen": "CN",
  "ningbo": "CN", "qingdao": "CN", "tianjin": "CN", "xiamen": "CN",
  "hong kong": "HK", "singapore": "SG",
  "tokyo": "JP", "osaka": "JP", "yokohama": "JP", "nagoya": "JP",
  "seoul": "KR", "busan": "KR", "incheon": "KR",
  // India
  "mumbai": "IN", "new delhi": "IN", "delhi": "IN", "bangalore": "IN",
  "bengaluru": "IN", "chennai": "IN", "kolkata": "IN", "hyderabad": "IN",
  "pune": "IN", "ahmedabad": "IN",
  // Europe
  "paris": "FR", "marseille": "FR", "lyon": "FR",
  "berlin": "DE", "hamburg": "DE", "munich": "DE", "münchen": "DE",
  "frankfurt": "DE", "düsseldorf": "DE", "dusseldorf": "DE",
  "madrid": "ES", "barcelona": "ES", "valencia": "ES",
  "lisbon": "PT", "lisboa": "PT", "porto": "PT",
  "amsterdam": "NL", "rotterdam": "NL",
  "antwerp": "BE", "antwerpen": "BE", "brussels": "BE",
  "vienna": "AT", "wien": "AT",
  "zurich": "CH", "zürich": "CH", "geneva": "CH", "basel": "CH",
  "stockholm": "SE", "copenhagen": "DK", "oslo": "NO", "helsinki": "FI",
  "warsaw": "PL", "prague": "CZ", "praha": "CZ",
  "athens": "GR", "istanbul": "TR", "ankara": "TR", "izmir": "TR",
  // Latin America
  "mexico city": "MX", "ciudad de mexico": "MX",
  "são paulo": "BR", "sao paulo": "BR", "rio de janeiro": "BR",
  "buenos aires": "AR", "santiago": "CL", "lima": "PE", "bogotá": "CO",
  "bogota": "CO",
  // Middle East / Africa
  "riyadh": "SA", "jeddah": "SA", "dammam": "SA", "doha": "QA",
  "kuwait city": "KW", "manama": "BH", "muscat": "OM",
  "tel aviv": "IL", "haifa": "IL",
  "cairo": "EG", "alexandria": "EG", "casablanca": "MA", "tunis": "TN",
  "lagos": "NG", "nairobi": "KE", "johannesburg": "ZA", "cape town": "ZA",
  // Oceania
  "sydney": "AU", "melbourne": "AU", "brisbane": "AU", "perth": "AU",
  "auckland": "NZ", "wellington": "NZ",
  // Canada
  "toronto": "CA", "montreal": "CA", "vancouver": "CA", "calgary": "CA",
};

function stripParens(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

function normalizeCity(city: string): string {
  return stripParens(city)
    .toLowerCase()
    // Rimuovi suffissi tipo ", FL" o ", florida"
    .replace(/,.*$/, "")
    .trim();
}

/**
 * Restituisce un ISO2 maiuscolo derivato da `country` (preferito) o `city`,
 * oppure null se non identificabile. Mai stringhe a caso.
 */
export function deriveCountryCode(
  country: string | null | undefined,
  city: string | null | undefined
): string | null {
  const c = (country || "").trim();
  if (c.length === 2 && /^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  if (c.length >= 3) {
    const iso = NAME_TO_ISO[c.toLowerCase()];
    if (iso) return iso;
  }
  const cityNorm = (city || "").trim();
  if (cityNorm) {
    // Alcuni record hanno il NOME PAESE nel campo city.
    if (cityNorm.length >= 3) {
      const iso = NAME_TO_ISO[cityNorm.toLowerCase()];
      if (iso) return iso;
    }
    const key = normalizeCity(cityNorm);
    if (CITY_TO_ISO[key]) return CITY_TO_ISO[key];
  }
  return null;
}