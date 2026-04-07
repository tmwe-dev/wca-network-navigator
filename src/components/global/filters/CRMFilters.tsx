import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Layers, Database, Users, Plane, Wifi, Sparkles, Shield, Globe, Check } from "lucide-react";
import { FilterDropdownMulti, type FilterOption } from "@/components/global/FilterDropdownMulti";
import { capitalizeFirst } from "@/lib/capitalize";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { resolveCountryCode, getCountryFlag } from "@/lib/countries";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { cn } from "@/lib/utils";
import { FilterSection, ChipGroup, Chip, CRM_GROUPBY } from "./shared";

export function CRMFilters() {
  const g = useGlobalFilters();
  const [countrySearch, setCountrySearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [crmCountries, setCrmCountries] = useState<{ value: string; name: string; flag: string; total: number }[]>([]);
  const [crmOrigins, setCrmOrigins] = useState<FilterOption[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const pageSize = 1000;

        const allRows: any[] = [];
        let from = 0;
        while (true) {
          const { data: page, error } = await supabase
            .from("imported_contacts")
            .select("country, origin")
            .range(from, from + pageSize - 1);
          if (error || !page || page.length === 0) break;
          allRows.push(...page);
          if (page.length < pageSize) break;
          from += pageSize;
        }

        const countryCounts: Record<string, number> = {};
        const originCounts: Record<string, number> = {};
        allRows.forEach((r: any) => {
          const raw = (r.country || "").trim();
          if (raw) countryCounts[raw] = (countryCounts[raw] || 0) + 1;
          const o = (r.origin || "").trim();
          if (o) originCounts[o] = (originCounts[o] || 0) + 1;
        });

        setCrmCountries(
          Object.entries(countryCounts)
            .map(([value, total]) => {
              const resolved = resolveCountryCode(value);
              const wcaCountry = resolved ? WCA_COUNTRIES.find((c: any) => c.code === resolved) : null;
              return { value, name: wcaCountry?.name || value, flag: resolved ? getCountryFlag(resolved) : "", total };
            })
            .sort((a, b) => b.total - a.total)
        );

        setCrmOrigins(
          Object.entries(originCounts)
            .map(([value, count]) => ({ value, label: capitalizeFirst(value), count }))
            .sort((a, b) => (b.count || 0) - (a.count || 0))
        );
      } catch (e) { console.error("[FiltersDrawer] failed to fetch CRM filter data:", e); }
    };
    fetchData();
  }, []);

  const selectedCountries = useMemo(
    () => crmCountries.filter((c) => g.filters.crmSelectedCountries.has(c.value)),
    [crmCountries, g.filters.crmSelectedCountries]
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    const matches = !q
      ? crmCountries
      : crmCountries.filter(c => c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q));
    return [...matches].sort((a, b) => {
      const aS = g.filters.crmSelectedCountries.has(a.value) ? 1 : 0;
      const bS = g.filters.crmSelectedCountries.has(b.value) ? 1 : 0;
      if (aS !== bS) return bS - aS;
      return b.total - a.total;
    });
  }, [crmCountries, countrySearch, g.filters.crmSelectedCountries]);

  const toggleCountry = (value: string) => {
    const next = new Set(g.filters.crmSelectedCountries);
    if (next.has(value)) next.delete(value); else next.add(value);
    g.setCrmSelectedCountries(next);
  };

  const toggleCrmOrigin = (val: string) => {
    const next = new Set(g.filters.crmOrigin);
    if (next.has(val)) next.delete(val); else next.add(val);
    g.setCrmOrigin(next);
  };

  const toggleLeadStatus = (val: string) => {
    if (val === g.filters.leadStatus) g.setLeadStatus("all");
    else g.setLeadStatus(val);
  };

  const toggleHolding = (val: string) => {
    if (val === g.filters.holdingPattern) g.setHoldingPattern("all");
    else g.setHoldingPattern(val);
  };

  const toggleChannel = (val: string) => {
    if (val === g.filters.crmChannel) g.setCrmChannel("all");
    else g.setCrmChannel(val);
  };

  const toggleQuality = (val: string) => {
    if (val === g.filters.crmQuality) g.setCrmQuality("all");
    else g.setCrmQuality(val);
  };

  // Search
  const searchValue = g.filters.search;
  useEffect(() => {
    if (searchValue.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const doSearch = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("imported_contacts")
          .select("id, name, company_name, company_alias, country, email, position")
          .or(`name.ilike.%${searchValue}%,company_name.ilike.%${searchValue}%,company_alias.ilike.%${searchValue}%,email.ilike.%${searchValue}%`)
          .limit(30);
        setSearchResults(data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    };
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Build filter options for dropdowns
  const statusOptions: FilterOption[] = [
    { value: "new", label: "Nuovo" },
    { value: "contacted", label: "Contattato" },
    { value: "qualified", label: "Qualificato" },
    { value: "converted", label: "Convertito" },
  ];

  const holdingOptions: FilterOption[] = [
    { value: "out", label: "Fuori circuito" },
    { value: "in", label: "In circuito" },
  ];

  const channelOptions: FilterOption[] = [
    { value: "with_email", label: "📧 Email" },
    { value: "with_phone", label: "📱 Telefono" },
    { value: "with_linkedin", label: "🔗 LinkedIn" },
    { value: "with_whatsapp", label: "💬 WhatsApp" },
  ];

  const qualityOptions: FilterOption[] = [
    { value: "enriched", label: "Arricchiti" },
    { value: "not_enriched", label: "Non arricchiti" },
    { value: "with_alias", label: "Con alias" },
    { value: "no_alias", label: "Senza alias" },
  ];

  const selectedStatus = new Set(g.filters.leadStatus !== "all" ? [g.filters.leadStatus] : []);
  const selectedHolding = new Set(g.filters.holdingPattern !== "all" ? [g.filters.holdingPattern] : []);
  const selectedChannel = new Set(g.filters.crmChannel !== "all" ? [g.filters.crmChannel] : []);
  const selectedQuality = new Set(g.filters.crmQuality !== "all" ? [g.filters.crmQuality] : []);

  return (
    <>
      {/* Search */}
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Contatto, azienda, email..." className="h-8 text-xs bg-muted/30 border-border/40" />
        {searchValue.trim().length >= 2 && (
          <div className="mt-2 max-h-[250px] overflow-y-auto rounded-lg border border-border/40 bg-muted/10 divide-y divide-border/20">
            {searching ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Ricerca in corso...</div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Nessun risultato per "{searchValue}"</div>
            ) : (
              <>
                <div className="px-2.5 py-1.5 bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground">{searchResults.length} risultati</span>
                </div>
                {searchResults.map((c: any) => {
                  const resolvedCountry = resolveCountryCode(c.country || "");
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("crm-select-contact", { detail: { contactId: c.id } }));
                        window.dispatchEvent(new CustomEvent("filters-drawer-close"));
                      }}
                      className="w-full text-left px-2.5 py-2 hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm shrink-0 w-4 text-center">{resolvedCountry ? getCountryFlag(resolvedCountry) : ""}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{c.company_alias || c.company_name || "—"}</p>
                          {c.name && <p className="text-[10px] text-muted-foreground truncate">{c.name}{c.position ? ` · ${c.position}` : ""}</p>}
                        </div>
                        {c.email && <span className="text-[9px] text-muted-foreground truncate max-w-[110px]">{c.email}</span>}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </FilterSection>

      {/* Raggruppa per */}
      <FilterSection icon={Layers} label="Raggruppa per">
        <ChipGroup>
          {CRM_GROUPBY.map(o => (
            <Chip key={o.value} active={g.filters.groupBy === o.value} onClick={() => g.setGroupBy(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Dropdown filters — compact */}
      <div className="space-y-1.5">
        <FilterDropdownMulti
          label="Origine"
          icon={Database}
          options={crmOrigins}
          selected={g.filters.crmOrigin}
          onToggle={toggleCrmOrigin}
          searchable
          placeholder="Cerca origine..."
        />

        <FilterDropdownMulti
          label="Stato"
          icon={Users}
          options={statusOptions}
          selected={selectedStatus}
          onToggle={toggleLeadStatus}
          singleSelect
          capitalize={false}
        />

        <FilterDropdownMulti
          label="Circuito"
          icon={Plane}
          options={holdingOptions}
          selected={selectedHolding}
          onToggle={toggleHolding}
          singleSelect
          capitalize={false}
          activeColor={g.filters.holdingPattern === "in" ? "danger" : g.filters.holdingPattern === "out" ? "info" : "default"}
        />

        <FilterDropdownMulti
          label="Canale"
          icon={Wifi}
          options={channelOptions}
          selected={selectedChannel}
          onToggle={toggleChannel}
          singleSelect
          capitalize={false}
        />

        <FilterDropdownMulti
          label="Qualità"
          icon={Sparkles}
          options={qualityOptions}
          selected={selectedQuality}
          onToggle={toggleQuality}
          singleSelect
          capitalize={false}
        />
      </div>

      {/* WCA Match filter */}
      <FilterSection icon={Shield} label="Match WCA">
        <ChipGroup>
          {[
            { value: "all", label: "Tutti" },
            { value: "matched", label: "Matchati" },
            { value: "unmatched", label: "Non matchati" },
          ].map(o => (
            <Chip key={o.value} active={g.filters.crmWcaMatch === o.value} onClick={() => g.setCrmWcaMatch(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Countries — identical to Network */}
      <FilterSection icon={Globe} label={`Paesi (${g.filters.crmSelectedCountries.size > 0 ? g.filters.crmSelectedCountries.size + ' sel.' : 'tutti'})`}>
        {selectedCountries.length > 0 && (
          <div className="mb-1.5 rounded-lg border border-primary/20 bg-primary/5 p-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-primary">Paesi attivi</span>
              <button onClick={() => g.setCrmSelectedCountries(new Set())} className="text-[9px] text-destructive hover:underline">Reset</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedCountries.map(c => (
                <button key={c.value} onClick={() => toggleCountry(c.value)} className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                  {c.flag} {c.name} ×
                </button>
              ))}
            </div>
          </div>
        )}
        <Input value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Cerca paese..." className="h-7 text-xs bg-muted/30 border-border/40 mb-1.5" />
        <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border/40 bg-muted/10 p-1">
          {filteredCountries.map(c => (
            <button
              key={c.value}
              onClick={() => toggleCountry(c.value)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all",
                g.filters.crmSelectedCountries.has(c.value) ? "bg-primary/15 text-primary" : "hover:bg-muted/40"
              )}
            >
              <span className="text-sm">{c.flag}</span>
              <span className="flex-1 text-left truncate font-medium">{c.name}</span>
              {g.filters.crmSelectedCountries.has(c.value) && <Check className="w-3 h-3 text-primary" />}
              <span className="text-[9px] tabular-nums opacity-60">{c.total}</span>
            </button>
          ))}
          {filteredCountries.length === 0 && <div className="px-2 py-3 text-[10px] text-muted-foreground text-center">Nessun paese trovato</div>}
        </div>
      </FilterSection>
    </>
  );
}
