/**
 * useEmailContactPicker — logic extracted from EmailComposerContactPicker
 */
import { useReducer, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcGetCountryStats, rpcGetContactFilterOptions } from "@/data/rpc";
import { getCountryCodesBatched } from "@/data/partners";
import { useMission } from "@/contexts/MissionContext";
import { getCountryFlag } from "@/lib/countries";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";
import { createLogger } from "@/lib/log";
import { pickerReducer, INITIAL_PICKER_STATE, type CountryStat, type PartnerRow, type PartnerContactRow, type ImportedContactRow, type BcaRow } from "@/components/global/email-picker/types";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("EmailComposerContactPicker");

interface FilterOptionRow {
  filter_type: string;
  filter_value: string | null;
}

export function useEmailContactPicker() {
  const [state, dispatch] = useReducer(pickerReducer, INITIAL_PICKER_STATE);
  const { addRecipient, recipients, removeRecipient, clearRecipients } = useMission();

  const shouldSearch = state.search.length >= 3 || !!state.selectedCountry;

  // ── Country stats ──
  const { data: countryStats = [] } = useQuery<CountryStat[]>({
    queryKey: ["picker-country-stats-v2"],
    queryFn: async () => {
      try {
        const rpcData = await rpcGetCountryStats();
        if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          return (rpcData as Array<{ country_code: string | null; total_partners: number | string }>)
            .filter((r) => r.country_code)
            .map((r) => ({
              code: r.country_code!,
              count: Number(r.total_partners || 0),
              flag: getCountryFlag(r.country_code!),
              name: WCA_COUNTRIES_MAP[r.country_code!]?.name || r.country_code!,
            }));
        }
      } catch (e) {
        log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      }
      const counts = await getCountryCodesBatched();
      return Object.entries(counts).map(([code, count]) => ({
        code, count,
        flag: getCountryFlag(code),
        name: WCA_COUNTRIES_MAP[code]?.name || code,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Origin options
  const { data: originOptions = [] } = useQuery<string[]>({
    queryKey: queryKeys.contacts.pickerOrigins,
    queryFn: async () => {
      const data = await rpcGetContactFilterOptions();
      if (!data) return [];
      return (data as FilterOptionRow[])
        .filter((d) => d.filter_type === "origin" && d.filter_value)
        .map((d) => d.filter_value as string);
    },
  });

  const sortedCountries = useMemo(() => {
    const copy = [...countryStats];
    if (state.countrySort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    else copy.sort((a, b) => b.count - a.count);
    return copy;
  }, [countryStats, state.countrySort]);

  // ── Partners ──
  const { data: partners = [] } = useQuery<PartnerRow[]>({
    queryKey: ["picker-partners", state.search, state.selectedCountry],
    enabled: state.tab === "partners",
    queryFn: async () => {
      let q = supabase
        .from("partners")
        .select("id, company_name, company_alias, country_code, city, lead_status");
      if (state.search.length >= 3) q = q.ilike("company_name", `%${state.search}%`);
      if (state.selectedCountry) q = q.eq("country_code", state.selectedCountry);
      q = q.eq("is_active", true);
      const { data } = await q.order("company_name").limit(200);
      return (data ?? []) as PartnerRow[];
    },
  });

  // Partner contacts
  const { data: partnerContacts = [] } = useQuery<PartnerContactRow[]>({
    queryKey: ["picker-partner-contacts", state.expandedPartner],
    enabled: !!state.expandedPartner,
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_contacts")
        .select("id, name, contact_alias, email, title")
        .eq("partner_id", state.expandedPartner!)
        .order("is_primary", { ascending: false });
      return (data ?? []) as PartnerContactRow[];
    },
  });

  // ── Contacts ──
  const { data: contacts = [] } = useQuery<ImportedContactRow[]>({
    queryKey: queryKeys.contacts.picker(state.search, state.selectedCountry, state.originFilter),
    enabled: state.tab === "contacts",
    queryFn: async () => {
      let q = supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, country, contact_alias, company_alias, lead_status, origin, position");
      if (state.search.length >= 3) q = q.or(`name.ilike.%${state.search}%,company_name.ilike.%${state.search}%,email.ilike.%${state.search}%`);
      if (state.selectedCountry) {
        const countryName = WCA_COUNTRIES_MAP[state.selectedCountry]?.name;
        if (countryName) q = q.ilike("country", `%${countryName}%`);
      }
      if (state.originFilter !== "all") q = q.eq("origin", state.originFilter);
      const { data } = await q.limit(200);
      return (data ?? []) as ImportedContactRow[];
    },
  });

  // ── BCA ──
  const { data: bcaCards = [] } = useQuery<BcaRow[]>({
    queryKey: ["picker-bca", state.search, state.selectedCountry],
    enabled: state.tab === "bca",
    queryFn: async () => {
      let q = supabase
        .from("business_cards")
        .select("id, contact_name, company_name, email, location, matched_partner_id, lead_status");
      if (state.search.length >= 3) {
        q = q.or(`contact_name.ilike.%${state.search}%,company_name.ilike.%${state.search}%,email.ilike.%${state.search}%`);
      }
      if (state.selectedCountry) {
        const countryName = WCA_COUNTRIES_MAP[state.selectedCountry]?.name;
        if (countryName) q = q.ilike("location", `%${countryName}%`);
      }
      const { data } = await q.limit(200);
      return (data ?? []) as BcaRow[];
    },
  });

  // ── Filtered & sorted lists ──
  const filteredPartners = useMemo(() => {
    const list = state.hideHolding ? partners.filter(p => p.lead_status !== "holding_pattern") : partners;
    const sorted = [...list];
    switch (state.partnerSort) {
      case "name": sorted.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "")); break;
      case "country": sorted.sort((a, b) => (a.country_code || "").localeCompare(b.country_code || "")); break;
    }
    return sorted;
  }, [partners, state.hideHolding, state.partnerSort]);

  const filteredContacts = useMemo(() => {
    const list = state.hideHolding ? contacts.filter(c => c.lead_status !== "holding_pattern") : contacts;
    const sorted = [...list];
    switch (state.contactSort) {
      case "name": sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
      case "company": sorted.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "")); break;
      case "origin": sorted.sort((a, b) => (a.origin || "").localeCompare(b.origin || "")); break;
      case "country": sorted.sort((a, b) => (a.country || "").localeCompare(b.country || "")); break;
    }
    return sorted;
  }, [contacts, state.hideHolding, state.contactSort]);

  const groupedContacts = useMemo(() => {
    const groups: Record<string, ImportedContactRow[]> = {};
    filteredContacts.forEach(c => {
      const key = c.company_name || "Senza azienda";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredContacts]);

  const filteredBca = useMemo(() => {
    const list = state.hideHolding ? bcaCards.filter(c => c.lead_status !== "holding_pattern") : bcaCards;
    const sorted = [...list];
    switch (state.bcaSort) {
      case "name": sorted.sort((a, b) => (a.contact_name || "").localeCompare(b.contact_name || "")); break;
      case "company": sorted.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "")); break;
      case "location": sorted.sort((a, b) => (a.location || "").localeCompare(b.location || "")); break;
    }
    return sorted;
  }, [bcaCards, state.hideHolding, state.bcaSort]);

  const currentCount = state.tab === "partners" ? filteredPartners.length
    : state.tab === "contacts" ? filteredContacts.length
    : filteredBca.length;

  // ── Selection helpers ──
  const isSelected = (partnerId: string, contactId?: string) => {
    return recipients.some(r =>
      r.partnerId === partnerId && (contactId ? r.contactId === contactId : !r.contactId)
    );
  };

  const handleSelectPartner = (p: PartnerRow) => {
    if (isSelected(p.id)) return;
    addRecipient({
      partnerId: p.id,
      companyName: p.company_name || "",
      companyAlias: p.company_alias || undefined,
      email: null,
      city: p.city || "",
      countryName: WCA_COUNTRIES_MAP[p.country_code || ""]?.name || p.country_code || "",
      countryCode: p.country_code || undefined,
      isEnriched: false,
    });
  };

  const handleSelectContact = (
    partnerId: string,
    companyName: string,
    companyAlias: string | undefined,
    countryCode: string | undefined,
    c: PartnerContactRow,
  ) => {
    if (isSelected(partnerId, c.id)) return;
    addRecipient({
      partnerId, companyName, companyAlias,
      contactId: c.id, contactName: c.name || undefined,
      contactAlias: c.contact_alias || undefined,
      email: c.email, city: "",
      countryName: "", countryCode: countryCode || undefined,
      isEnriched: !!c.email,
    });
  };

  const handleSelectImported = (c: ImportedContactRow) => {
    if (isSelected(c.id)) return;
    addRecipient({
      partnerId: c.id,
      companyName: c.company_name || "",
      companyAlias: c.company_alias || undefined,
      contactName: c.name || undefined,
      contactAlias: c.contact_alias || undefined,
      email: c.email, city: "",
      countryName: c.country || "",
      isEnriched: !!c.email,
    });
  };

  const handleSelectBca = (c: BcaRow) => {
    const pid = c.matched_partner_id || c.id;
    if (isSelected(pid)) return;
    addRecipient({
      partnerId: pid,
      companyName: c.company_name || "",
      contactName: c.contact_name || undefined,
      email: c.email, city: c.location || "",
      countryName: "", isEnriched: !!c.email,
    });
  };

  const handleSelectAll = () => {
    if (state.tab === "partners") filteredPartners.forEach(p => handleSelectPartner(p));
    else if (state.tab === "contacts") filteredContacts.forEach(c => handleSelectImported(c));
    else filteredBca.forEach(c => handleSelectBca(c));
  };

  return {
    state,
    dispatch,
    // Data
    sortedCountries,
    originOptions,
    filteredPartners,
    partnerContacts,
    filteredContacts,
    groupedContacts,
    filteredBca,
    currentCount,
    shouldSearch,
    // Recipients
    recipients,
    removeRecipient,
    clearRecipients,
    // Actions
    isSelected,
    handleSelectPartner,
    handleSelectContact,
    handleSelectImported,
    handleSelectBca,
    handleSelectAll,
  };
}

export type UseEmailContactPickerReturn = ReturnType<typeof useEmailContactPicker>;
