export function guessCountryFromLocation(location: string | null, phone: string | null): string | null {
  if (!location && !phone) return null;
  if (location) {
    const loc = location.toLowerCase();
    const map: Record<string, string> = {
      india: "IN", china: "CN", cina: "CN", usa: "US", "united states": "US",
      brazil: "BR", "united kingdom": "UK", uk: "GB", turkey: "TR", turchia: "TR",
      singapore: "SG", bangladesh: "BD", korea: "KR", "saudi arabia": "SA",
      messico: "MX", mexico: "MX", germany: "DE", germania: "DE", france: "FR",
      francia: "FR", italia: "IT", italy: "IT", spain: "ES", spagna: "ES",
      japan: "JP", giappone: "JP", australia: "AU", canada: "CA",
    };
    for (const [name, code] of Object.entries(map)) {
      if (loc.includes(name)) return code;
    }
  }
  if (phone) {
    const clean = phone.replace(/[^+\d]/g, "");
    const prefixes: Record<string, string> = {
      "+91": "IN", "+86": "CN", "+1": "US", "+55": "BR", "+44": "GB",
      "+90": "TR", "+65": "SG", "+88": "BD", "+82": "KR", "+966": "SA",
      "+52": "MX", "+49": "DE", "+33": "FR", "+39": "IT", "+34": "ES",
      "+81": "JP", "+61": "AU",
    };
    for (const [prefix, code] of Object.entries(prefixes)) {
      if (clean.startsWith(prefix)) return code;
    }
  }
  return null;
}

export function countryCodeToFlag(code: string | null): string {
  if (!code || code.length !== 2) return "🌍";
  const upper = code.toUpperCase();
  const codePoints = upper.split("").map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
