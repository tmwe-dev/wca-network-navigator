/**
 * CountryWorkbench — shell with filters + partner table
 * Split into: CountryWorkbenchFilters, CountryWorkbenchTable, CountryWorkbenchTypes
 */
import { useState, useMemo, useCallback } from "react";
import { getYearsMember } from "@/lib/countries";
import { getBranchCountries } from "@/lib/partnerUtils";
import { TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { CountryWorkbenchFilters } from "./CountryWorkbenchFilters";
import { CountryWorkbenchTable } from "./CountryWorkbenchTable";
import type { SortField, SortDir, SortEntry, CountryWorkbenchProps, PartnerRowData } from "./CountryWorkbenchTypes";
import { DEFAULT_DIRS } from "./CountryWorkbenchTypes";

const ALL_SERVICES = [...TRANSPORT_SERVICES, ...SPECIALTY_SERVICES];

const hasService = (p: PartnerRowData, svc: string) =>
  (p.partner_services || []).some((s) => s.service_category === svc);

const sortFns: Record<SortField, (a: PartnerRowData, b: PartnerRowData, dir: SortDir) => number> = {
  name: (a, b, dir) => { const cmp = (a.company_name || "").localeCompare(b.company_name || ""); return dir === "asc" ? cmp : -cmp; },
  city: (a, b, dir) => { const cmp = (a.city || "").localeCompare(b.city || ""); return dir === "asc" ? cmp : -cmp; },
  rating: (a, b, dir) => { const cmp = (a.rating || 0) - (b.rating || 0); return dir === "asc" ? cmp : -cmp; },
  years: (a, b, dir) => { const cmp = getYearsMember(a.member_since) - getYearsMember(b.member_since); return dir === "asc" ? cmp : -cmp; },
};

const VALID_NETWORKS = new Set([
  "WCA Inter Global", "WCA First", "WCA Advanced Professionals",
  "WCA China Global", "WCA Projects", "WCA Dangerous Goods",
  "WCA Perishables", "WCA Time Critical", "WCA Pharma",
  "WCA eCommerce", "WCA eCommerce Solutions", "WCA Relocations",
  "WCA Live Events & Expo", "Global Affinity Alliance",
  "Lognet Global", "Infinite Connection",
  "Elite Global Logistics Network",
]);

export function CountryWorkbench({
  countryCode, partners, onBack, onSelectPartner,
  selectedId, selectedIds, onToggleSelection, onSelectAllFiltered,
}: CountryWorkbenchProps) {
  const [sortStack, setSortStack] = useState<SortEntry[]>([{ field: "name", dir: "asc" }]);
  const [activeServiceFilters, setActiveServiceFilters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [networkFilter, setNetworkFilter] = useState<string | null>(null);
  const [branchCountryFilter, setBranchCountryFilter] = useState<string | null>(null);

  const handleSortToggle = useCallback((field: SortField) => {
    setSortStack((prev) => {
      const idx = prev.findIndex((s) => s.field === field);
      const defaultDir = DEFAULT_DIRS[field];
      const oppositeDir: SortDir = defaultDir === "asc" ? "desc" : "asc";
      if (idx === -1) return [...prev, { field, dir: defaultDir }];
      if (prev[idx].dir === defaultDir) { const next = [...prev]; next[idx] = { field, dir: oppositeDir }; return next; }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const toggleServiceFilter = useCallback((svc: string) => {
    setActiveServiceFilters((prev) => { const next = new Set(prev); next.has(svc) ? next.delete(svc) : next.add(svc); return next; });
  }, []);

  const countryPartners = useMemo(
    () => (partners || []).filter((p) => p.country_code === countryCode),
    [partners, countryCode]
  );

  const availableServices = useMemo(() =>
    ALL_SERVICES.filter((svc) => countryPartners.some((p) => hasService(p, svc))),
    [countryPartners]
  );

  const availableNetworks = useMemo(() => {
    const names = new Set<string>();
    countryPartners.forEach((p) => {
      (p.partner_networks || []).forEach((n) => { if (VALID_NETWORKS.has(n.network_name)) names.add(n.network_name); });
    });
    return Array.from(names).sort();
  }, [countryPartners]);

  const availableBranchCountries = useMemo(() => {
    const map = new Map<string, string>();
    countryPartners.forEach((p) => { getBranchCountries(p).forEach((b) => map.set(b.code, b.name)); });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [countryPartners]);

  const filteredPartners = useMemo(() => {
    let list = countryPartners;
    if (searchTerm) list = list.filter((p) => (p.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()));
    for (const svc of activeServiceFilters) list = list.filter((p) => hasService(p, svc));
    if (networkFilter) list = list.filter((p) => (p.partner_networks || []).some((n) => n.network_name === networkFilter));
    if (branchCountryFilter) list = list.filter((p) => getBranchCountries(p).some((b) => b.code === branchCountryFilter));
    return [...list].sort((a, b) => { for (const { field, dir } of sortStack) { const r = sortFns[field](a, b, dir); if (r !== 0) return r; } return 0; });
  }, [countryPartners, activeServiceFilters, searchTerm, sortStack, networkFilter, branchCountryFilter]);

  const allSelected = filteredPartners.length > 0 && filteredPartners.every((p) => selectedIds.has(p.id));

  const handleSelectAll = useCallback(() => {
    onSelectAllFiltered(allSelected ? [] : filteredPartners.map((p) => p.id));
  }, [allSelected, filteredPartners, onSelectAllFiltered]);

  return (
    <div className="flex flex-col h-full">
      <CountryWorkbenchFilters
        countryCode={countryCode}
        countryPartners={countryPartners}
        filteredPartners={filteredPartners}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortStack={sortStack}
        onSortToggle={handleSortToggle}
        activeServiceFilters={activeServiceFilters}
        onToggleServiceFilter={toggleServiceFilter}
        availableServices={availableServices}
        availableNetworks={availableNetworks}
        networkFilter={networkFilter}
        onNetworkFilterChange={setNetworkFilter}
        availableBranchCountries={availableBranchCountries}
        branchCountryFilter={branchCountryFilter}
        onBranchCountryFilterChange={setBranchCountryFilter}
        allSelected={allSelected}
        onSelectAll={handleSelectAll}
        onBack={onBack}
      />
      <CountryWorkbenchTable
        filteredPartners={filteredPartners}
        selectedId={selectedId}
        selectedIds={selectedIds}
        onSelectPartner={onSelectPartner}
        onToggleSelection={onToggleSelection}
      />
    </div>
  );
}
