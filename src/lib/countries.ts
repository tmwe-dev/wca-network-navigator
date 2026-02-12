// Country flag emoji from country code
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

// Format years of membership
export function getYearsMember(memberSince: string | null): number {
  if (!memberSince) return 0;
  const start = new Date(memberSince);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
}

// Format partner type for display
export function formatPartnerType(type: string | null): string {
  if (!type) return "Partner";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Format service category for display
export function formatServiceCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.toUpperCase())
    .join(" ");
}

// Service category colors - unified muted palette
export function getServiceColor(_category: string): string {
  return "bg-muted text-foreground border border-border";
}

// Service category icon names for lucide-react
export function getServiceIconName(category: string): string {
  const icons: Record<string, string> = {
    air_freight: "Plane",
    ocean_fcl: "Ship",
    ocean_lcl: "Ship",
    road_freight: "Truck",
    rail_freight: "TrainFront",
    project_cargo: "Package",
    dangerous_goods: "AlertTriangle",
    perishables: "Snowflake",
    pharma: "Pill",
    ecommerce: "ShoppingCart",
    relocations: "Home",
    customs_broker: "FileCheck",
    warehousing: "Warehouse",
    nvocc: "Anchor",
  };
  return icons[category] || "Box";
}

// Service icon color mapping (Tailwind classes) - per-service colors
const SERVICE_ICON_COLORS: Record<string, string> = {
  air_freight: "text-sky-400",
  ocean_fcl: "text-blue-500",
  ocean_lcl: "text-blue-500",
  road_freight: "text-amber-500",
  rail_freight: "text-slate-500",
  project_cargo: "text-violet-500",
  dangerous_goods: "text-red-500",
  perishables: "text-cyan-500",
  pharma: "text-green-500",
  ecommerce: "text-orange-500",
  relocations: "text-pink-500",
  customs_broker: "text-indigo-500",
  warehousing: "text-amber-700",
  nvocc: "text-teal-500",
};

export function getServiceIconColor(category: string): string {
  return SERVICE_ICON_COLORS[category] || "text-slate-500";
}

// Resolve a market name (e.g. "UAE", "Saudi Arabia") to ISO country code
import { WCA_COUNTRIES } from "@/data/wcaCountries";

const MARKET_ALIASES: Record<string, string> = {
  uae: "AE", "united arab emirates": "AE", emirates: "AE",
  usa: "US", "united states": "US", "united states of america": "US", america: "US",
  uk: "GB", "united kingdom": "GB", england: "GB", britain: "GB",
  "saudi arabia": "SA", saudi: "SA", ksa: "SA",
  china: "CN", prc: "CN",
  "south korea": "KR", korea: "KR",
  "north korea": "KP",
  russia: "RU",
  taiwan: "TW",
  "hong kong": "HK",
  macau: "MO",
  japan: "JP",
  india: "IN",
  brazil: "BR",
  germany: "DE",
  france: "FR",
  italy: "IT",
  spain: "ES",
  turkey: "TR",
  egypt: "EG",
  "south africa": "ZA",
  australia: "AU",
  canada: "CA",
  mexico: "MX",
  singapore: "SG",
  malaysia: "MY",
  thailand: "TH",
  vietnam: "VN",
  indonesia: "ID",
  philippines: "PH",
  pakistan: "PK",
  bangladesh: "BD",
  "sri lanka": "LK",
  nepal: "NP",
  iran: "IR",
  iraq: "IQ",
  kuwait: "KW",
  qatar: "QA",
  bahrain: "BH",
  oman: "OM",
  jordan: "JO",
  lebanon: "LB",
  israel: "IL",
  nigeria: "NG",
  kenya: "KE",
  ghana: "GH",
  morocco: "MA",
  tunisia: "TN",
  algeria: "DZ",
  colombia: "CO",
  chile: "CL",
  argentina: "AR",
  peru: "PE",
  venezuela: "VE",
  ecuador: "EC",
  panama: "PA",
  netherlands: "NL", holland: "NL",
  belgium: "BE",
  switzerland: "CH",
  austria: "AT",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  poland: "PL",
  portugal: "PT",
  greece: "GR",
  romania: "RO",
  "czech republic": "CZ", czechia: "CZ",
  hungary: "HU",
  ireland: "IE",
  scotland: "GB",
  wales: "GB",
  "new zealand": "NZ",
  myanmar: "MM", burma: "MM",
  cambodia: "KH",
  laos: "LA",
};

export function resolveCountryCode(marketName: string): string | null {
  if (!marketName) return null;
  const lower = marketName.toLowerCase().trim();

  // Direct alias
  if (MARKET_ALIASES[lower]) return MARKET_ALIASES[lower];

  // If it's already a 2-letter code
  if (lower.length === 2) {
    const upper = lower.toUpperCase();
    if (WCA_COUNTRIES.find((c) => c.code === upper)) return upper;
  }

  // Match against WCA_COUNTRIES by name
  const exact = WCA_COUNTRIES.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact.code;

  // Partial match
  const partial = WCA_COUNTRIES.find(
    (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  );
  if (partial) return partial.code;

  return null;
}

// Partner type icon name mapping
export function getPartnerTypeIconName(type: string | null): string {
  const icons: Record<string, string> = {
    freight_forwarder: "Truck",
    customs_broker: "FileCheck",
    carrier: "Ship",
    nvocc: "Anchor",
    "3pl": "Warehouse",
    courier: "Package",
  };
  return icons[type || ""] || "Box";
}

// Priority colors
export function getPriorityColor(priority: string | null): string {
  switch (priority) {
    case "high":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-warning text-warning-foreground";
    case "low":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}
