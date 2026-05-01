/**
 * useWcaPartnersAsCompanies — adapter WCA → CompanyEntity[]
 *
 * Strategia:
 *  - Carica i partner filtrati per i paesi attualmente selezionati nello stato
 *    globale (`networkSelectedCountries`). I contatti referenti arrivano già
 *    inclusi dalla DAL (`partner_contacts`), quindi NON serve lazy-load extra.
 *  - Mappa ogni partner a una `CompanyEntity` con badge "WCA" e meta anni
 *    membership.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { findPartners, type PartnerWithRelations } from "@/data/partners";
import { queryKeys } from "@/lib/queryKeys";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import type { CompanyEntity, ContactEntity } from "@/v2/ui/molecules/CompanyCardList";

function yearsSince(dateIso: string | null | undefined): number | undefined {
  if (!dateIso) return undefined;
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) return undefined;
  const diff = Date.now() - t;
  const y = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return y >= 0 ? y : undefined;
}

function mapContacts(p: PartnerWithRelations): ContactEntity[] {
  const list = p.partner_contacts ?? [];
  const partnerInHolding = p.lead_status === "holding";
  return list.map((c) => {
    const row = c as unknown as Record<string, unknown>;
    const contactInHolding =
      row.in_holding_pattern === true || partnerInHolding;
    return {
      id: c.id,
      name: c.contact_alias || c.name || "—",
      role: c.title,
      email: c.email,
      phone: c.direct_phone || c.mobile,
      channels: {
        email: !!c.email,
        whatsapp: !!(c.mobile && c.mobile.length > 4),
        linkedin: false,
        phone: !!(c.direct_phone || c.mobile),
      },
      inHolding: contactInHolding,
      companyId: p.id,
      raw: c,
    };
  });
}

function mapPartner(p: PartnerWithRelations): CompanyEntity {
  const contacts = mapContacts(p);
  const wcaYears = yearsSince(p.member_since ?? null);
  return {
    id: p.id,
    name: p.company_alias || p.company_name,
    city: p.city,
    countryCode: p.country_code,
    source: "wca",
    badge: { label: "WCA", tone: "wca" },
    contactsCount: contacts.length,
    contacts,
    meta: {
      wcaYears,
      logoUrl: p.logo_url ?? null,
      holding: p.lead_status === "holding",
    },
    raw: p,
  };
}

export interface UseWcaPartnersAsCompaniesResult {
  companies: CompanyEntity[];
  isLoading: boolean;
  error: unknown;
}

export function useWcaPartnersAsCompanies(): UseWcaPartnersAsCompaniesResult {
  const { filters } = useGlobalFilters();
  const countries = useMemo<string[]>(
    () => Array.from(filters.networkSelectedCountries ?? new Set<string>()) as string[],
    [filters.networkSelectedCountries]
  );
  const search = filters.networkSearch || "";

  const filterKey = useMemo(
    () => ({ countries, search }),
    [countries, search]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.partners.filtered({
      scope: "companyList.wca",
      ...filterKey,
    } as Record<string, unknown>),
    queryFn: async () => {
      // Per evitare di caricare 12k partner d'un colpo quando nessun paese
      // è selezionato, restituiamo lista vuota: l'utente sceglie il paese
      // dalla sidebar (UX coerente con l'attuale CountryGridV2).
      if (countries.length === 0 && !search) return [] as PartnerWithRelations[];
      const rows = await findPartners({
        countries: countries.length ? countries : undefined,
        search: search || undefined,
      });
      return rows;
    },
    staleTime: 60_000,
  });

  const companies = useMemo(
    () => (data ?? []).map(mapPartner),
    [data]
  );

  return { companies, isLoading, error };
}