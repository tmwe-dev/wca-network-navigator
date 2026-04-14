/**
 * Phone number normalisation — lightweight, no external libs.
 */

const COUNTRY_PREFIXES: Record<string, string> = {
  IT: "39", US: "1", GB: "44", DE: "49", FR: "33", ES: "34",
  NL: "31", BE: "32", AT: "43", CH: "41", BR: "55", IN: "91",
  CN: "86", JP: "81", AU: "61", RU: "7", MX: "52", AE: "971",
  SA: "966", ZA: "27", SG: "65", HK: "852", TH: "66", KR: "82",
};

/**
 * Normalise a raw phone string into E.164-ish format.
 * Returns null if the input is not recognisable.
 */
export function normalizePhone(raw: string, defaultCountry?: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  // Strip whitespace, dashes, parentheses, dots
  let cleaned = raw.replace(/[\s\-().·]/g, "");

  // Remove leading "tel:" or "whatsapp:" URI prefixes
  cleaned = cleaned.replace(/^(tel:|whatsapp:)/i, "");

  if (!cleaned) return null;

  // Already has '+' prefix
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    if (digits.length >= 8) return "+" + digits;
    return null;
  }

  // Starts with '00' (international dialling prefix)
  if (cleaned.startsWith("00")) {
    const digits = cleaned.slice(2).replace(/\D/g, "");
    if (digits.length >= 8) return "+" + digits;
    return null;
  }

  // Pure digits — try adding country prefix
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 6 && defaultCountry) {
    const prefix = COUNTRY_PREFIXES[defaultCountry.toUpperCase()];
    if (prefix) {
      // If the number already starts with the country code, don't double-add
      if (digits.startsWith(prefix)) {
        return digits.length >= 8 ? "+" + digits : null;
      }
      // Remove leading 0 (national trunk prefix)
      const national = digits.startsWith("0") ? digits.slice(1) : digits;
      const full = prefix + national;
      return full.length >= 8 ? "+" + full : null;
    }
  }

  // Digits only, no default country
  if (digits.length >= 10) return "+" + digits;

  return null;
}
