/**
 * useCrmContactsAsCompanies — adapter Contatti CRM → CompanyEntity[]
 *
 * Strategia:
 *  - Recupera la lista paginata corrente di `imported_contacts` (chunks da
 *    50 via `useContactsPaginated`). NON aggrega lato server: il
 *    raggruppamento per azienda avviene client-side sulle pagine già caricate.
 *  - I contatti sono raggruppati per `company_name` (case-insensitive +
 *    trimming). Fallback al dominio email quando `company_name` è vuoto.
 *  - I contatti senza azienda né dominio finiscono in un gruppo "Senza
 *    azienda" coerente con il resto della lista.
 */
import { useMemo } from "react";
import { useContactsPaginated } from "@/hooks/useContactsPaginated";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import type {
  CompanyEntity,
  ContactEntity,
} from "@/v2/ui/molecules/CompanyCardList";

interface RawContact {
  id: string;
  name?: string | null;
  company_name?: string | null;
  company_alias?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  city?: string | null;
  country?: string | null;
  position?: string | null;
  wca_partner_id?: string | null;
  interaction_count?: number | null;
  unread_count?: number | null;
  [k: string]: unknown;
}

function normalizeCompanyKey(name: string | null | undefined, email: string | null | undefined): {
  key: string;
  display: string;
} {
  const n = (name || "").trim();
  if (n) return { key: n.toLowerCase(), display: n };
  if (email && email.includes("@")) {
    const dom = email.split("@")[1]?.toLowerCase().trim();
    if (dom) return { key: `__dom:${dom}`, display: dom };
  }
  return { key: "__none", display: "Senza azienda" };
}

function toContactEntity(c: RawContact, companyId: string): ContactEntity {
  return {
    id: c.id,
    name: c.name || c.email || "—",
    role: c.position ?? null,
    email: c.email ?? null,
    phone: c.phone ?? c.mobile ?? null,
    channels: {
      email: !!c.email,
      whatsapp: !!(c.mobile && c.mobile.length > 4),
      linkedin: false,
      phone: !!(c.phone || c.mobile),
    },
    unreadCount: typeof c.unread_count === "number" ? c.unread_count : undefined,
    companyId,
    raw: c,
  };
}

export interface UseCrmContactsAsCompaniesResult {
  companies: CompanyEntity[];
  isLoading: boolean;
  error: unknown;
  hasMore: boolean;
  fetchNextPage: () => Promise<unknown>;
  totalContacts: number;
}

export function useCrmContactsAsCompanies(): UseCrmContactsAsCompaniesResult {
  const { filters } = useGlobalFilters();

  const queryFilters = useMemo(
    () => ({
      search: filters.search || undefined,
      countries: Array.from(filters.crmSelectedCountries ?? new Set<string>()) as string[],
      origins: Array.from(filters.crmOrigin ?? new Set<string>()) as string[],
      quality: filters.crmQuality !== "all" ? filters.crmQuality : undefined,
      channel: filters.crmChannel !== "all" ? filters.crmChannel : undefined,
      wcaMatch: filters.crmWcaMatch !== "all"
        ? (filters.crmWcaMatch as "matched" | "unmatched")
        : undefined,
      holdingPattern: (filters.holdingPattern as "out" | "in" | "all") || "all",
      sort: "company_asc" as const,
    }),
    [filters]
  );

  const { data, isLoading, error, hasNextPage, fetchNextPage } = useContactsPaginated(
    queryFilters
  );

  const allContacts = useMemo<RawContact[]>(() => {
    const pages = data?.pages ?? [];
    const all: RawContact[] = [];
    for (const p of pages) {
      const list = ((p as { contacts?: unknown[] }).contacts ?? []) as RawContact[];
      all.push(...list);
    }
    return all;
  }, [data]);

  const companies = useMemo<CompanyEntity[]>(() => {
    const groups = new Map<string, { display: string; rows: RawContact[] }>();
    for (const c of allContacts) {
      const { key, display } = normalizeCompanyKey(
        c.company_alias || c.company_name,
        c.email
      );
      const g = groups.get(key);
      if (g) g.rows.push(c);
      else groups.set(key, { display, rows: [c] });
    }
    const out: CompanyEntity[] = [];
    for (const [key, g] of groups.entries()) {
      const first = g.rows[0];
      const id = `crm:${key}`;
      const contacts = g.rows.map((row) => toContactEntity(row, id));
      const matched = g.rows.some((r) => !!r.wca_partner_id);
      out.push({
        id,
        name: g.display,
        city: first.city ?? null,
        countryCode: first.country ?? null,
        source: "crm",
        badge: matched
          ? { label: "WCA", tone: "wca" }
          : { label: "CRM", tone: "neutral" },
        contactsCount: contacts.length,
        contacts,
        raw: { rows: g.rows },
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [allContacts]);

  return {
    companies,
    isLoading,
    error,
    hasMore: !!hasNextPage,
    fetchNextPage,
    totalContacts: allContacts.length,
  };
}