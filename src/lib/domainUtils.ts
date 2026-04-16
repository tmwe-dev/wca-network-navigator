/**
 * Domain utilities — favicon URLs and TLD-to-country flag mapping
 */

/** TLD to country code mapping (ISO 3166-1 alpha-2) */
const TLD_COUNTRY_MAP: Record<string, string> = {
  ac: "AC", ad: "AD", ae: "AE", af: "AF", ag: "AG", ai: "AI", al: "AL", am: "AM",
  ao: "AO", ar: "AR", at: "AT", au: "AU", az: "AZ", ba: "BA", bb: "BB", bd: "BD",
  be: "BE", bf: "BF", bg: "BG", bh: "BH", bi: "BI", bj: "BJ", bm: "BM", bn: "BN",
  bo: "BO", br: "BR", bs: "BS", bt: "BT", bw: "BW", by: "BY", bz: "BZ", ca: "CA",
  cd: "CD", cf: "CF", cg: "CG", ch: "CH", ci: "CI", cl: "CL", cm: "CM", cn: "CN",
  co: "CO", cr: "CR", cu: "CU", cv: "CV", cy: "CY", cz: "CZ", de: "DE", dj: "DJ",
  dk: "DK", dm: "DM", do: "DO", dz: "DZ", ec: "EC", ee: "EE", eg: "EG", er: "ER",
  es: "ES", et: "ET", fi: "FI", fj: "FJ", fr: "FR", ga: "GA", gb: "GB", gd: "GD",
  ge: "GE", gh: "GH", gm: "GM", gn: "GN", gq: "GQ", gr: "GR", gt: "GT", gw: "GW",
  gy: "GY", hk: "HK", hn: "HN", hr: "HR", ht: "HT", hu: "HU", id: "ID", ie: "IE",
  il: "IL", in: "IN", iq: "IQ", ir: "IR", is: "IS", it: "IT", jm: "JM", jo: "JO",
  jp: "JP", ke: "KE", kg: "KG", kh: "KH", kr: "KR", kw: "KW", kz: "KZ", la: "LA",
  lb: "LB", lc: "LC", li: "LI", lk: "LK", lr: "LR", ls: "LS", lt: "LT", lu: "LU",
  lv: "LV", ly: "LY", ma: "MA", mc: "MC", md: "MD", me: "ME", mg: "MG", mk: "MK",
  ml: "ML", mm: "MM", mn: "MN", mo: "MO", mr: "MR", mt: "MT", mu: "MU", mv: "MV",
  mw: "MW", mx: "MX", my: "MY", mz: "MZ", na: "NA", ne: "NE", ng: "NG", ni: "NI",
  nl: "NL", no: "NO", np: "NP", nz: "NZ", om: "OM", pa: "PA", pe: "PE", pg: "PG",
  ph: "PH", pk: "PK", pl: "PL", pr: "PR", ps: "PS", pt: "PT", py: "PY", qa: "QA",
  ro: "RO", rs: "RS", ru: "RU", rw: "RW", sa: "SA", sb: "SB", sc: "SC", sd: "SD",
  se: "SE", sg: "SG", si: "SI", sk: "SK", sl: "SL", sm: "SM", sn: "SN", so: "SO",
  sr: "SR", sv: "SV", sy: "SY", sz: "SZ", td: "TD", tg: "TG", th: "TH", tj: "TJ",
  tm: "TM", tn: "TN", to: "TO", tr: "TR", tt: "TT", tw: "TW", tz: "TZ", ua: "UA",
  ug: "UG", uk: "GB", us: "US", uy: "UY", uz: "UZ", ve: "VE", vn: "VN", ye: "YE",
  za: "ZA", zm: "ZM", zw: "ZW",
};

/** Country code to flag emoji */
function countryToFlag(cc: string): string {
  return cc
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

/** Extract TLD from domain (handles co.uk, com.au etc.) */
function extractCountryTld(domain: string): string | null {
  const parts = domain.toLowerCase().split(".");
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  // Skip generic TLDs
  if (["com", "net", "org", "info", "biz", "io", "dev", "app", "tech", "xyz"].includes(last)) {
    // Check second-level for country (e.g. .co.uk, .com.au)
    if (parts.length >= 3) {
      const secondLast = parts[parts.length - 2];
      if (["co", "com", "net", "org", "ac", "gov", "edu"].includes(secondLast)) {
        return TLD_COUNTRY_MAP[last] ? last : null;
      }
    }
    return null;
  }
  return TLD_COUNTRY_MAP[last] ? last : null;
}

/** Get country flag emoji from email domain. Returns null for generic TLDs. */
export function getFlagFromDomain(domain: string): string | null {
  if (!domain) return null;
  const tld = extractCountryTld(domain);
  if (!tld) return null;
  const cc = TLD_COUNTRY_MAP[tld];
  return cc ? countryToFlag(cc) : null;
}

/** Get favicon URL from domain using DuckDuckGo (no fake Google placeholders) */
export function getDomainFaviconUrl(domain: string): string {
  if (!domain) return "";
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}
