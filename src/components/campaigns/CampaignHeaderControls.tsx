/**
 * CampaignHeaderControls — Source toggle, country picker, stats badges
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Building2, Send, Check, ChevronsUpDown, Briefcase, CreditCard } from "lucide-react";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import type { CampaignSource, CampaignPartner } from "./useCampaignData";

interface Props {
  countries: { code: string; name: string; count: number }[];
  selectedCountry: string | null;
  onCountrySelect: (code: string | null) => void;
  countriesWithPartners: number;
  totalPartners: number;
  campaignPartners: CampaignPartner[];
  onGenerateJobs: () => void;
  source: CampaignSource;
  onSourceChange: (s: CampaignSource) => void;
  bcaCountryCounts: Record<string, number>;
}

export function CampaignHeaderControls({
  countries, selectedCountry, onCountrySelect, countriesWithPartners,
  totalPartners, campaignPartners, onGenerateJobs, source, onSourceChange,
  bcaCountryCounts,
}: Props) {
  const [comboOpen, setComboOpen] = useState(false);
  const [countrySortBy, setCountrySortBy] = useState<"name" | "count">("name");

  const sortedCountries = useMemo(() => {
    let list: { code: string; name: string; count: number }[];
    if (source === "bca") {
      list = Object.entries(bcaCountryCounts).map(([code, count]) => ({
        code,
        name: WCA_COUNTRIES_MAP[code]?.name || code,
        count,
      }));
    } else {
      list = [...countries];
    }
    if (countrySortBy === "count") {
      return list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, source, bcaCountryCounts, countrySortBy]);

  const selectedName = selectedCountry ? WCA_COUNTRIES_MAP[selectedCountry]?.name : null;
  const totalWithEmail = campaignPartners.filter((p) => p.email).length;
  const uniqueCountries = new Set(campaignPartners.map((p) => p.country_code)).size;

  return (
    <>
      <Tabs value={source} onValueChange={(v) => onSourceChange(v as CampaignSource)}>
        <TabsList className="bg-card/50 border border-border">
          <TabsTrigger value="partners" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Building2 className="w-3.5 h-3.5 mr-1" />Partner
          </TabsTrigger>
          <TabsTrigger value="bca" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <CreditCard className="w-3.5 h-3.5 mr-1" />BCA
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="w-px h-6 bg-border" />

      <Popover open={comboOpen} onOpenChange={setComboOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={comboOpen} className="w-56 justify-between">
            {selectedName
              ? <span className="truncate">{getCountryFlag(selectedCountry!)} {selectedName}</span>
              : <span className="text-muted-foreground">🌍 Cerca paese...</span>}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 z-50" align="start">
          <Command>
            <CommandInput placeholder="Cerca paese..." />
            <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30">
              <span className="text-[10px] text-muted-foreground mr-1">Ordina:</span>
              <button onClick={() => setCountrySortBy("name")} className={cn("px-2 py-0.5 rounded text-[10px] transition-colors", countrySortBy === "name" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30")}>A→Z</button>
              <button onClick={() => setCountrySortBy("count")} className={cn("px-2 py-0.5 rounded text-[10px] transition-colors", countrySortBy === "count" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30")}>#Partner</button>
            </div>
            <CommandList className="max-h-60">
              <CommandEmpty className="text-muted-foreground">Nessun paese trovato</CommandEmpty>
              <CommandGroup>
                {sortedCountries.map((country) => (
                  <CommandItem key={country.code} value={country.name} onSelect={() => { onCountrySelect(country.code); setComboOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", selectedCountry === country.code ? "opacity-100 text-primary" : "opacity-0")} />
                    <span>{getCountryFlag(country.code)}</span>
                    <span className="ml-1.5 truncate">{country.name}</span>
                    <span className={cn("ml-auto text-xs", country.count > 0 ? "text-primary" : "text-muted-foreground/40")}>{country.count}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="w-px h-6 bg-border" />

      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border">
          <span className="font-mono text-foreground">{source === "bca" ? Object.keys(bcaCountryCounts).length : countries.filter((c) => c.count > 0).length}</span>
          <span className="text-muted-foreground text-xs">Paesi</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <span className="font-mono text-emerald-400">{countriesWithPartners}</span>
          <span className="text-muted-foreground text-xs">Attivi</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
          <span className="font-mono text-primary">{totalPartners}</span>
          <span className="text-muted-foreground text-xs">{source === "bca" ? "BCA" : "Partner"}</span>
        </div>
      </div>

      {selectedCountry && (
        <>
          <div className="w-px h-6 bg-border" />
          <Button variant="ghost" size="sm" onClick={() => onCountrySelect(null)} className="text-primary hover:text-primary/80 hover:bg-primary/10">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Reset
          </Button>
        </>
      )}

      <div className="flex-1" />

      {campaignPartners.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground/80">
            <Send className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">{campaignPartners.length}</span>
            <span className="text-muted-foreground">aziende</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-primary">{uniqueCountries}</span>
            <span className="text-muted-foreground">paesi</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-foreground">{totalWithEmail}</span>
            <span className="text-muted-foreground">email</span>
          </div>
          <Button onClick={onGenerateJobs} size="sm" className="space-button-primary">
            <Briefcase className="w-4 h-4 mr-1.5" />Genera Jobs
          </Button>
        </div>
      )}
    </>
  );
}
