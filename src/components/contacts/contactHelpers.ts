import { resolveCountryCode, getCountryFlag } from "@/lib/countries";

export function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t === "" || t.toUpperCase() === "NULL") return null;
  return t;
}

export function countryFlag(country: string | null): string {
  if (!country) return "🌍";
  const code = resolveCountryCode(country);
  if (!code) return "🌍";
  return getCountryFlag(code);
}

export function formatPhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}

export function getContactQuality(c: any): "good" | "partial" | "poor" {
  const has = (v: any) => !!clean(v);
  const fields = [has(c.company_name), has(c.name), has(c.email), has(c.phone || c.mobile), has(c.country)];
  const filled = fields.filter(Boolean).length;
  if (filled >= 4) return "good";
  if (filled >= 2) return "partial";
  return "poor";
}

export type SortKey = "name" | "company" | "city" | "date";

export function sortContacts(contacts: any[], sortKey: SortKey): any[] {
  const sorted = [...contacts];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "company":
        return (a.company_name || "").localeCompare(b.company_name || "");
      case "name":
        return (a.name || "").localeCompare(b.name || "");
      case "city":
        return (a.city || "").localeCompare(b.city || "");
      case "date":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
  return sorted;
}
