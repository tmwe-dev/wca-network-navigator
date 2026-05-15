import { useState, useMemo } from "react";
import { guessCountryFromLocation, countryCodeToFlag } from "./bcaUtils";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

/** Estrae il dominio "pulito" da una URL o da un'email. */
function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  // email → parte dopo @
  if (raw.includes("@")) {
    const after = raw.split("@")[1] ?? "";
    return after ? after.toLowerCase().replace(/^www\./, "") : null;
  }
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/** Domini pubblici di posta da escludere come fonte del logo aziendale. */
const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.it", "outlook.com",
  "hotmail.com", "hotmail.it", "live.com", "live.it", "icloud.com",
  "me.com", "aol.com", "libero.it", "tiscali.it", "tin.it", "alice.it",
  "virgilio.it", "fastwebnet.it", "pec.it", "protonmail.com", "proton.me",
]);

function faviconFor(domain: string | null): string | null {
  if (!domain) return null;
  if (PUBLIC_MAIL_DOMAINS.has(domain)) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

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

export interface EventEntry {
  name: string;
  count: number;
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
  const [eventFilter, setEventFilter] = useState<string | null>(null);

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

  const events = useMemo<EventEntry[]>(() => {
    const counts = new Map<string, number>();
    for (const c of cardsWithCountry) {
      const name = (c.event_name || "").trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
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
    if (eventFilter) {
      list = list.filter(c => (c.event_name || "").trim() === eventFilter);
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
  }, [cardsWithCountry, selectedCountry, eventFilter, search, onlyMatched, onlyWithEmail, hideHolding]);

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
    eventFilter, setEventFilter, events,
    cardsWithCountry, countries, totalCompanies, filtered, holdingCount, groups,
  };
}
