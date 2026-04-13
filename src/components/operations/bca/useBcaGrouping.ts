import { useState, useMemo } from "react";
import { guessCountryFromLocation, countryCodeToFlag } from "./bcaUtils";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

export type ViewMode = "compact" | "card" | "expanded";
export type SortMode = "name_asc" | "name_desc" | "contacts_desc" | "matched_first";

export interface BcaGroup {
  key: string;
  companyName: string;
  logoUrl: string | null;
  hasDeepSearch: boolean;
  isMatched: boolean;
  inHolding: boolean;
  partnerId: string | null;
  countryCode: string | null;
  cards: BusinessCardWithPartner[];
}

export interface CountryEntry {
  code: string | null;
  label: string;
  flag: string;
  companyCount: number;
  contactCount: number;
}

interface CardWithCountry extends BusinessCardWithPartner {
  _country: string | null;
}

export function useBcaGrouping(cards: BusinessCardWithPartner[]) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [sortMode, setSortMode] = useState<SortMode>("matched_first");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [onlyMatched, setOnlyMatched] = useState(false);
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [hideHolding, setHideHolding] = useState(true);

  const cardsWithCountry: CardWithCountry[] = useMemo(() => {
    return cards.map(c => ({
      ...c,
      _country: c.partner?.country_code || guessCountryFromLocation(c.location, c.phone || c.mobile),
    }));
  }, [cards]);

  const countries = useMemo(() => {
    const map = new Map<string | null, { companies: Set<string>; contacts: number }>();
    for (const c of cardsWithCountry) {
      const cc = c._country || null;
      if (!map.has(cc)) map.set(cc, { companies: new Set(), contacts: 0 });
      const entry = map.get(cc)!;
      const companyKey = c.matched_partner_id || (c.company_name || "").toLowerCase().trim();
      entry.companies.add(companyKey);
      entry.contacts++;
    }
    const result: CountryEntry[] = [];
    for (const [code, data] of map) {
      result.push({
        code,
        label: code || "N/D",
        flag: countryCodeToFlag(code),
        companyCount: data.companies.size,
        contactCount: data.contacts,
      });
    }
    return result.sort((a, b) => b.contactCount - a.contactCount);
  }, [cardsWithCountry]);

  const totalCompanies = useMemo(() => {
    const s = new Set<string>();
    for (const c of cardsWithCountry) {
      s.add(c.matched_partner_id || (c.company_name || "").toLowerCase().trim());
    }
    return s.size;
  }, [cardsWithCountry]);

  const filtered = useMemo(() => {
    let list: CardWithCountry[] = cardsWithCountry;
    if (selectedCountry !== null) {
      if (selectedCountry === "__none__") {
        list = list.filter(c => !c._country);
      } else {
        list = list.filter(c => c._country === selectedCountry);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.company_name || "").toLowerCase().includes(q) ||
        (c.contact_name || "").toLowerCase().includes(q) ||
        (c.event_name || "").toLowerCase().includes(q)
      );
    }
    if (onlyMatched) list = list.filter(c => !!c.matched_partner_id);
    if (onlyWithEmail) list = list.filter(c => !!c.email);
    if (hideHolding) list = list.filter(c => !c.lead_status || c.lead_status === "new");
    return list;
  }, [cardsWithCountry, selectedCountry, search, onlyMatched, onlyWithEmail, hideHolding]);

  const holdingCount = useMemo(() => {
    return cardsWithCountry.filter(c => c.lead_status && c.lead_status !== "new").length;
  }, [cardsWithCountry]);

  const groups = useMemo(() => {
    const map = new Map<string, BcaGroup>();
    for (const card of filtered) {
      const key = card.matched_partner_id || (card.company_name || "sconosciuta").toLowerCase().trim();
      if (!map.has(key)) {
        const partner = card.partner;
        map.set(key, {
          key,
          companyName: partner?.company_name || card.company_name || "Sconosciuta",
          logoUrl: partner?.logo_url || null,
          hasDeepSearch: !!(partner?.enrichment_data as Record<string, unknown> | undefined)?.deep_search_at,
          isMatched: !!card.matched_partner_id,
          inHolding: !!(card.lead_status && card.lead_status !== "new"),
          partnerId: card.matched_partner_id || null,
          countryCode: card._country || null,
          cards: [],
        });
      }
      map.get(key)!.cards.push(card);
    }
    const arr = Array.from(map.values());
    switch (sortMode) {
      case "name_asc": return arr.sort((a, b) => a.companyName.localeCompare(b.companyName));
      case "name_desc": return arr.sort((a, b) => b.companyName.localeCompare(a.companyName));
      case "contacts_desc": return arr.sort((a, b) => b.cards.length - a.cards.length);
      case "matched_first":
      default:
        return arr.sort((a, b) => {
          if (a.isMatched !== b.isMatched) return a.isMatched ? -1 : 1;
          return b.cards.length - a.cards.length;
        });
    }
  }, [filtered, sortMode]);

  return {
    search, setSearch,
    viewMode, setViewMode,
    sortMode, setSortMode,
    selectedCountry, setSelectedCountry,
    sidebarOpen, setSidebarOpen,
    onlyMatched, setOnlyMatched,
    onlyWithEmail, setOnlyWithEmail,
    hideHolding, setHideHolding,
    cardsWithCountry, countries, totalCompanies, filtered, holdingCount, groups,
  };
}
