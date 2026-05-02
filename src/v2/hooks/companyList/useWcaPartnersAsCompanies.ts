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
import { findPartners, findPartnersPreview, type PartnerWithRelations } from "@/data/partners";
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
  const top = contacts[0];
  const ratingRaw = (p as unknown as { rating?: number | null }).rating ?? null;
  const score =
    ratingRaw != null ? Math.max(0, Math.min(100, Math.round(ratingRaw * 20))) : null;
  const pAny = p as unknown as Record<string, unknown>;
  const website = (pAny.website as string | null | undefined) ?? null;
  const services = Array.isArray(pAny.partner_services)
    ? (pAny.partner_services as Array<{ service_category?: string }>).map((s) => s.service_category || "").filter(Boolean)
    : [];
  const certifications = Array.isArray(pAny.partner_certifications)
    ? (pAny.partner_certifications as Array<{ certification?: string }>).map((c) => c.certification || "").filter(Boolean)
    : [];
  const networks = Array.isArray(pAny.partner_networks)
    ? (pAny.partner_networks as Array<{ network_name?: string }>).map((n) => n.network_name || "").filter(Boolean)
    : [];
  const aggChannels = {
    email: !!p.email || contacts.some((c) => c.channels.email),
    whatsapp: contacts.some((c) => c.channels.whatsapp),
    linkedin: contacts.some((c) => c.channels.linkedin),
    phone: !!p.phone || contacts.some((c) => c.channels.phone),
    website: !!website,
  };
  return {
    id: p.id,
    name: p.company_alias || p.company_name,
    city: p.city,
    countryCode: p.country_code,
    source: "wca",
    badge: { label: "WCA", tone: "wca" },
    contactsCount: contacts.length,
    contacts,
    score,
    primaryContact: top
      ? { name: top.name, role: top.role ?? null }
      : null,
    channels: aggChannels,
    meta: {
      wcaYears,
      logoUrl: p.logo_url ?? null,
      holding: p.lead_status === "holding",
    },
    leadStatus: (pAny.lead_status as string | null | undefined) ?? null,
    isFavorite: !!pAny.is_favorite,
    isActive: pAny.is_active !== false,
    officeType: (pAny.office_type as string | null | undefined) ?? null,
    partnerType: (pAny.partner_type as string | null | undefined) ?? null,
    lastInteractionAt: (pAny.last_interaction_at as string | null | undefined) ?? null,
    interactionCount: typeof pAny.interaction_count === "number" ? (pAny.interaction_count as number) : 0,
    enrichedAt: (pAny.enriched_at as string | null | undefined) ?? null,
    membershipExpires: (pAny.membership_expires as string | null | undefined) ?? null,
    services,
    certifications,
    networks,
    hasWebsite: !!website,
    hasLinkedin: false,
    hasLogo: !!p.logo_url,
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
  const qualityRaw = filters.networkQuality || "all";
  const qualityTokens = useMemo(
    () =>
      qualityRaw === "all" || !qualityRaw
        ? []
        : qualityRaw.split(",").map((s) => s.trim()).filter(Boolean),
    [qualityRaw]
  );

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
      // Default: nessun paese e nessuna ricerca → preview dei primi 50 partner
      // ordinati per nome, così l'utente ha sempre qualcosa con cui lavorare
      // entrando nella pagina (senza scaricare i 12k totali).
      if (countries.length === 0 && !search) {
        return await findPartnersPreview(50);
      }
      const rows = await findPartners({
        countries: countries.length ? countries : undefined,
        search: search || undefined,
      });
      return rows;
    },
    staleTime: 60_000,
  });

  const companies = useMemo(
    () => {
      const all = (data ?? []).map(mapPartner);
      if (qualityTokens.length === 0) return all;
      // Multi-select AND: tutti i token devono matchare.
      const test = (c: CompanyEntity, token: string): boolean => {
        switch (token) {
          case "with_email":    return c.channels?.email === true;
          case "no_email":      return !c.channels?.email;
          case "with_phone":    return c.channels?.phone === true;
          case "no_phone":      return !c.channels?.phone;
          case "with_profile":  return c.channels?.website === true || c.hasLinkedin === true;
          case "no_profile":    return !(c.channels?.website || c.hasLinkedin);
          case "with_contacts": return (c.contactsCount ?? 0) > 0;
          case "no_contacts":   return (c.contactsCount ?? 0) === 0;
          default:              return true;
        }
      };
      return all.filter((c) => qualityTokens.every((t) => test(c, t)));
    },
    [data, qualityTokens]
  );

  return { companies, isLoading, error };
}