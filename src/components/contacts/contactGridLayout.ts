/** Shared grid layout for ContactCard and ContactListPanel header.
 *
 * Single-row, high-density layout (apr 2026 redesign — BCA-aligned):
 *   [#☐] [AZIENDA + Contatto/Ruolo] [Località] [Email/Telefono] [Origine] [Stato · Score] [Azioni]
 *
 * Origine ha colonna propria (apr 2026 update): sortabile, filtrabile,
 * sempre visibile. Esempi: "csv", "wca", "linkedin", "manual", "biglietti".
 */
export const CONTACT_GRID_COLS =
  "60px minmax(200px,1.5fr) minmax(150px,190px) minmax(170px,1.1fr) 100px minmax(130px,150px) 64px";
export const CONTACT_GRID_CLASS = "grid items-center gap-x-3";

/** Capitalize first letter, rest lowercase */
export function capitalizeLabel(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Best-effort ZIP/CAP extractor from a free-form address string.
 * Recognises common shapes:
 *   "20019 Settimo Milanese, Italy"
 *   "1234 AB Amsterdam"
 *   "Via Roma 12, 00100 Roma RM"
 *   "London EC1A 1BB, UK"
 * Returns null when nothing plausible is found.
 */
export function extractZip(address: string | null | undefined): string | null {
  if (!address) return null;
  const s = String(address);
  // UK postcode (e.g. EC1A 1BB)
  const uk = s.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/);
  if (uk) return `${uk[1]} ${uk[2]}`;
  // Dutch (1234 AB)
  const nl = s.match(/\b(\d{4})\s?([A-Z]{2})\b/);
  if (nl) return `${nl[1]} ${nl[2]}`;
  // Generic 4-6 digit numeric (most EU/Asia/US)
  const num = s.match(/\b(\d{4,6})\b/);
  if (num) return num[1];
  return null;
}
