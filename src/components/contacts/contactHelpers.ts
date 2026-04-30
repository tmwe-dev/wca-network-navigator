import { resolveCountryCode, getCountryFlag } from "@/lib/countries";

export function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t === "" || t.toUpperCase() === "NULL") return null;
  return t;
}

export function countryFlag(country: string | null): string {
  if (!country) return "";
  const code = resolveCountryCode(country);
  if (!code) return "";
  return getCountryFlag(code);
}

export function formatPhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}
export function getContactQuality(c: Record<string, unknown>): "good" | "partial" | "poor" {
  const has = (v: unknown) => !!clean(v as string | null | undefined);
  const fields = [has(c.company_name), has(c.name), has(c.email), has(c.phone || c.mobile), has(c.country)];
  const filled = fields.filter(Boolean).length;
  if (filled >= 4) return "good";
  if (filled >= 2) return "partial";
  return "poor";
}

export type SortKey = "name" | "company" | "city" | "date" | "score";

export function sortContacts(contacts: Record<string, unknown>[], sortKey: SortKey): Record<string, unknown>[] {
  const sorted = [...contacts];
  const str = (v: unknown) => String(v || "");
  const num = (v: unknown) => Number(v) || 0;
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "company":
        return str(a.company_name).localeCompare(str(b.company_name));
      case "name":
        return str(a.name).localeCompare(str(b.name));
      case "city":
        return str(a.city).localeCompare(str(b.city));
      case "date":
        return new Date(str(b.created_at)).getTime() - new Date(str(a.created_at)).getTime();
      case "score":
        return num(b.lead_score) - num(a.lead_score);
    }
  });
  return sorted;
}
