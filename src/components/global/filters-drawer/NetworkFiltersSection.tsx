import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Globe, Check, Users, RefreshCw, ArrowUpDown, Plus, Minus } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { useCountryStats } from "@/hooks/useCountryStats";
import { getCountryFlag } from "@/lib/countries";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { NETWORK_QUALITY_TOGGLES, NETWORK_SORT } from "./constants";
import { createLogger } from "@/lib/log";

const log = createLogger("NetworkFiltersSection");

export function NetworkFiltersSection() {
  const g = useGlobalFilters();
  const { data: statsData } = useCountryStats();
  const [countrySearch, setCountrySearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; company_name: string; company_alias?: string | null; country_code: string; city?: string | null; email?: string | null; partner_contacts?: Array<{ id: string; name?: string | null; email?: string | null; contact_alias?: string | null; title?: string | null }> }>>([]);
  const [searching, setSearching] = useState(false);

  const countries = useMemo(() => {
    if (!statsData?.byCountry) return [];
    return Object.values(statsData.byCountry).map((s) => {
      const wcaCountry = WCA_COUNTRIES.find((c) => c.code === s.country_code);
      return {
        code: s.country_code,
        name: wcaCountry?.name || s.country_code,
        flag: getCountryFlag(s.country_code),
        total: s.total_partners || 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [statsData]);

  const selectedCountries = useMemo(
    () => countries.filter((country) => g.filters.networkSelectedCountries.has(country.code)),
    [countries, g.filters.networkSelectedCountries]
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    const matches = !q
      ? countries
      : countries.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    return [...matches].sort((a, b) => {
      const aSelected = g.filters.networkSelectedCountries.has(a.code) ? 1 : 0;
      const bSelected = g.filters.networkSelectedCountries.has(b.code) ? 1 : 0;
      if (aSelected !== bSelected) return bSelected - aSelected;
      return b.total - a.total;
    });
  }, [countries, countrySearch, g.filters.networkSelectedCountries]);

  const toggleCountry = (code: string) => {
    const next = new Set(g.filters.networkSelectedCountries);
    if (next.has(code)) next.delete(code); else next.add(code);
    g.setNetworkSelectedCountries(next);
  };

  const networkSearchValue = g.filters.networkSearch;
  useEffect(() => {
    if (networkSearchValue.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const doSearch = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("partners")
          .select("id, company_name, company_alias, country_code, city, email, partner_contacts(id, name, email, contact_alias, title)")
          .or(`company_name.ilike.%${networkSearchValue}%,company_alias.ilike.%${networkSearchValue}%,email.ilike.%${networkSearchValue}%`)
          .eq("is_active", true)
          .limit(30);
        setSearchResults(data || []);
      } catch (e) { log.warn("operation failed, state reset", { error: e instanceof Error ? e.message : String(e) }); setSearchResults([]); }
      finally { setSearching(false); }
    };
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [networkSearchValue]);

  const handleSyncWca = () => {
    window.dispatchEvent(new CustomEvent("sync-wca-trigger"));
  };

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={g.filters.networkSearch}
            onChange={e => g.setNetworkSearch(e.target.value)}
            placeholder="Partner, azienda, email…"
            className="h-9 pl-8 text-xs bg-background border-border focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        {networkSearchValue.trim().length >= 2 && (
          <div className="mt-2 max-h-[300px] overflow-y-auto rounded-lg border border-border/40 bg-muted/10 divide-y divide-border/20">
            {searching ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Ricerca in corso...</div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Nessun risultato per "{networkSearchValue}"</div>
            ) : (
              <>
                <div className="px-2.5 py-1.5 bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground">{searchResults.length} risultati</span>
                </div>
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("network-select-partner", { detail: { partnerId: p.id } }));
                      g.setNetworkSearch(p.company_name);
                      window.dispatchEvent(new CustomEvent("filters-drawer-close"));
                    }}
                    className="w-full text-left px-2.5 py-2 hover:bg-primary/10 transition-colors cursor-pointer rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm shrink-0">{getCountryFlag(p.country_code)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.company_alias || p.company_name}</p>
                        {p.city && <p className="text-[10px] text-muted-foreground">{p.city}</p>}
                      </div>
                      {p.email && <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{p.email}</span>}
                    </div>
                    {Array.isArray(p.partner_contacts) && p.partner_contacts.length > 0 && (
                      <div className="mt-1 ml-6 space-y-0.5">
                        {p.partner_contacts.slice(0, 3).map((c) => (
                          <div key={String(c.id)} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Users className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{String(c.contact_alias || c.name || "")}</span>
                            {c.title && <span className="text-[9px] opacity-60 truncate">· {String(c.title)}</span>}
                            {c.email && <span className="text-[9px] text-primary/70 truncate ml-auto">{String(c.email)}</span>}
                          </div>
                        ))}
                        {p.partner_contacts.length > 3 && (
                          <span className="text-[9px] text-muted-foreground/60">+{p.partner_contacts.length - 3} altri</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </FilterSection>

      <FilterSection icon={ArrowUpDown} label="Ordina partner">
        <ChipGroup columns={3}>
          {NETWORK_SORT.map(o => (
            <Chip key={o.value} block active={g.filters.networkSort === o.value} onClick={() => g.setNetworkSort(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      <FilterSection
        icon={Globe}
        label="Paesi"
        trailing={
          g.filters.networkSelectedCountries.size > 0 ? (
            <button
              onClick={() => g.setNetworkSelectedCountries(new Set())}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20"
            >
              {g.filters.networkSelectedCountries.size} attivi ✕
            </button>
          ) : (
            <span className="text-[10px] text-muted-foreground">Tutti</span>
          )
        }
      >
        {selectedCountries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedCountries.map((country) => (
              <button
                key={country.code}
                onClick={() => toggleCountry(country.code)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
              >
                <span>{country.flag}</span>
                <span>{country.code}</span>
                <span className="opacity-60">✕</span>
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={countrySearch}
            onChange={e => setCountrySearch(e.target.value)}
            placeholder="Cerca paese…"
            className="h-8 pl-7 text-xs bg-background border-border focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border bg-background/40 p-1">
          <div className="space-y-0.5">
            {filteredCountries.map(c => (
              <button
                key={c.code}
                onClick={() => toggleCountry(c.code)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all border-l-2",
                  g.filters.networkSelectedCountries.has(c.code)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-transparent hover:bg-muted text-foreground"
                )}
              >
                <span className="text-base">{c.flag}</span>
                <span className="flex-1 text-left truncate font-medium">{c.name}</span>
                {g.filters.networkSelectedCountries.has(c.code) && <Check className="w-3 h-3 text-primary" />}
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 tabular-nums">{c.total}</Badge>
              </button>
            ))}
            {filteredCountries.length === 0 && (
              <div className="px-2 py-3 text-[11px] text-muted-foreground">Nessun paese trovato.</div>
            )}
          </div>
        </div>
      </FilterSection>

      <FilterSection
        icon={Sparkles}
        label="Qualità dati"
        trailing={
          g.filters.networkQuality !== "all" ? (
            <button
              onClick={() => g.setNetworkQuality("all")}
              className="text-[10px] font-semibold text-primary hover:underline"
            >
              Reset
            </button>
          ) : null
        }
      >
        <div className="rounded-lg border border-border bg-background/40 overflow-hidden divide-y divide-border/40">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-1.5 bg-muted/30 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Campo</span>
            <span className="w-9 text-center">Con</span>
            <span className="w-9 text-center">Senza</span>
          </div>
          {NETWORK_QUALITY_TOGGLES.map((t) => {
            const isWith = g.filters.networkQuality === t.withValue;
            const isWithout = g.filters.networkQuality === t.withoutValue;
            return (
              <div key={t.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span>{t.icon}</span>
                  <span className="font-medium">{t.label}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Solo con ${t.label}`}
                  onClick={() => g.setNetworkQuality(isWith ? "all" : t.withValue)}
                  className={cn(
                    "h-6 w-9 rounded-md border flex items-center justify-center transition-all",
                    isWith
                      ? "bg-primary/15 border-primary text-primary"
                      : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Solo senza ${t.label}`}
                  onClick={() => g.setNetworkQuality(isWithout ? "all" : t.withoutValue)}
                  className={cn(
                    "h-6 w-9 rounded-md border flex items-center justify-center transition-all",
                    isWithout
                      ? "bg-destructive/15 border-destructive text-destructive"
                      : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection icon={RefreshCw} label="Azioni">
        <Button variant="default" size="sm" className="w-full h-9 text-xs gap-2" onClick={handleSyncWca}>
          <RefreshCw className="w-3 h-3" /> Sincronizza WCA
        </Button>
      </FilterSection>
    </>
  );
}
