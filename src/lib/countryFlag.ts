/**
 * Country flag emoji lookup.
 * Estratto da outreachMockData.ts (rimosso) — utility puro, nessun dato demo.
 */
const FLAG_MAP: Record<string, string> = {
  IT: "🇮🇹", AE: "🇦🇪", BR: "🇧🇷", SE: "🇸🇪", CN: "🇨🇳", GB: "🇬🇧", IN: "🇮🇳",
  US: "🇺🇸", DE: "🇩🇪", FR: "🇫🇷", ES: "🇪🇸", JP: "🇯🇵",
};

export function getCountryFlag(code: string | null | undefined): string {
  if (!code) return "🏳️";
  return FLAG_MAP[code.toUpperCase()] || "🏳️";
}
