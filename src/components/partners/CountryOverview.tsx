import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getCountryFlag, getYearsMember } from "@/lib/countries";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Users,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Star,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CountryOverviewProps {
  partners: any[];
  isLoading: boolean;
  onSelectPartner: (id: string) => void;
  selectedId: string | null;
}

interface CountryGroup {
  code: string;
  name: string;
  flag: string;
  total: number;
  withContacts: number;
  partners: any[];
}

export function CountryOverview({ partners, isLoading, onSelectPartner, selectedId }: CountryOverviewProps) {
  const [search, setSearch] = useState("");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "total" | "pct">("name");
  const [filterMode, setFilterMode] = useState<"all" | "complete" | "incomplete">("all");

  const countryGroups = useMemo(() => {
    const map = new Map<string, CountryGroup>();
    (partners || []).forEach((p: any) => {
      if (!map.has(p.country_code)) {
        map.set(p.country_code, {
          code: p.country_code,
          name: p.country_name,
          flag: getCountryFlag(p.country_code),
          total: 0,
          withContacts: 0,
          partners: [],
        });
      }
      const group = map.get(p.country_code)!;
      group.total++;
      const q = getPartnerContactQuality(p.partner_contacts);
      if (q === "complete" || q === "partial") {
        group.withContacts++;
      }
      group.partners.push(p);
    });

    const groups = Array.from(map.values());
    return groups;
  }, [partners]);

  const filteredGroups = useMemo(() => {
    let result = countryGroups;

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) => g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q)
      );
    }

    // Filter by completeness
    if (filterMode === "complete") {
      result = result.filter((g) => g.withContacts === g.total && g.total > 0);
    } else if (filterMode === "incomplete") {
      result = result.filter((g) => g.withContacts < g.total);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "total") return b.total - a.total;
      if (sortBy === "pct") {
        const pctA = a.total > 0 ? a.withContacts / a.total : 0;
        const pctB = b.total > 0 ? b.withContacts / b.total : 0;
        return pctB - pctA;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [countryGroups, search, sortBy, filterMode]);

  const totalPartners = partners?.length || 0;
  const totalWithContacts = useMemo(
    () => (partners || []).filter((p: any) => {
      const q = getPartnerContactQuality(p.partner_contacts);
      return q === "complete" || q === "partial";
    }).length,
    [partners]
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header stats */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca paese..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
         />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="h-7 text-xs w-[120px]">
              <ArrowUpDown className="w-3 h-3 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="total">Totale</SelectItem>
              <SelectItem value="pct">% Completi</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as any)}>
            <SelectTrigger className="h-7 text-xs w-[120px]">
              <Filter className="w-3 h-3 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="complete">Completi</SelectItem>
              <SelectItem value="incomplete">Incompleti</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {filteredGroups.length} paesi
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {totalPartners} partner
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            {totalWithContacts} con dati
          </span>
        </div>
      </div>

      {/* Country list */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredGroups.map((group) => {
            const isOpen = expandedCountry === group.code;
            const completePct = group.total > 0 ? Math.round((group.withContacts / group.total) * 100) : 0;

            return (
              <Collapsible
                key={group.code}
                open={isOpen}
                onOpenChange={() => setExpandedCountry(isOpen ? null : group.code)}
              >
                <CollapsibleTrigger className="w-full text-left p-3 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xl shrink-0">{group.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{group.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {/* Mini progress bar */}
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              completePct >= 75 ? "bg-emerald-500" : completePct >= 40 ? "bg-amber-500" : "bg-destructive"
                            )}
                            style={{ width: `${completePct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{completePct}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{group.total}</p>
                        <p className="text-[10px] text-muted-foreground">totali</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-semibold", group.withContacts > 0 ? "text-emerald-600" : "text-destructive")}>
                          {group.withContacts}
                        </p>
                        <p className="text-[10px] text-muted-foreground">con dati</p>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="bg-muted/30 divide-y divide-border/50">
                    {group.partners
                      .sort((a: any, b: any) => a.company_name.localeCompare(b.company_name))
                      .map((partner: any) => {
                        const q = getPartnerContactQuality(partner.partner_contacts);
                        const contactCount = (partner.partner_contacts || []).length;
                        const hasEmail = (partner.partner_contacts || []).some((c: any) => c.email);
                        const hasPhone = (partner.partner_contacts || []).some((c: any) => c.direct_phone || c.mobile);

                        return (
                          <div
                            key={partner.id}
                            onClick={() => onSelectPartner(partner.id)}
                            className={cn(
                              "pl-12 pr-3 py-2 hover:bg-accent/50 transition-colors cursor-pointer flex items-center gap-2",
                              selectedId === partner.id && "bg-accent",
                              q === "missing" && "border-l-4 border-l-destructive",
                              q === "partial" && "border-l-4 border-l-amber-400",
                              q === "complete" && "border-l-4 border-l-primary",
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{partner.company_name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {partner.city}
                                </span>
                                {partner.rating > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    {partner.rating.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {q === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                              {q === "partial" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                              {q === "missing" && <AlertTriangle className="w-4 h-4 text-destructive" />}
                              <span className="text-[10px] text-muted-foreground">
                                {contactCount} cont.
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
