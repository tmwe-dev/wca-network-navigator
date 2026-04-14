import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getCountryFlag } from "@/lib/countries";
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
  MessageCircle,
  Mail,
  CheckSquare,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CountryOverviewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Supabase join shape
  partners: Array<Record<string, any>>;
  isLoading: boolean;
  onSelectPartner: (id: string) => void;
  selectedId: string | null;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onSelectAllFiltered?: (ids: string[]) => void;
}

interface CountryGroup {
  code: string;
  name: string;
  flag: string;
  total: number;
  withContacts: number;
  withWhatsApp: number;
  withEmail: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partners: Array<Record<string, any>>;
}

type ContactFilter = "all" | "whatsapp" | "email";

export function CountryOverview({
  partners,
  isLoading,
  onSelectPartner,
  selectedId,
  selectedIds = new Set(),
  onToggleSelection,
  onSelectAllFiltered,
}: CountryOverviewProps) {
  const [search, setSearch] = useState("");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "total" | "pct">("name");
  const [filterMode, setFilterMode] = useState<"all" | "complete" | "incomplete">("all");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");

  const hasWhatsApp = (p: any) => // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic partner shape
    (p.partner_contacts || []).some((c: any) => c.mobile); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
  const hasEmail = (p: any) => // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
    (p.partner_contacts || []).some((c: any) => c.email); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type

  const countryGroups = useMemo(() => {
    const map = new Map<string, CountryGroup>();
    (partners || []).forEach((p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic partner shape from Supabase join
      if (!map.has(p.country_code)) {
        map.set(p.country_code, {
          code: p.country_code,
          name: p.country_name,
          flag: getCountryFlag(p.country_code),
          total: 0,
          withContacts: 0,
          withWhatsApp: 0,
          withEmail: 0,
          partners: [],
        });
      }
      const group = map.get(p.country_code)!;
      group.total++;
      const q = getPartnerContactQuality(p.partner_contacts);
      if (q === "complete" || q === "partial") group.withContacts++;
      if (hasWhatsApp(p)) group.withWhatsApp++;
      if (hasEmail(p)) group.withEmail++;
      group.partners.push(p);
    });
    return Array.from(map.values());
  }, [partners]);

  const filteredGroups = useMemo(() => {
    let result = countryGroups;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) => g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q)
      );
    }

    if (filterMode === "complete") {
      result = result.filter((g) => g.withContacts === g.total && g.total > 0);
    } else if (filterMode === "incomplete") {
      result = result.filter((g) => g.withContacts < g.total);
    }

    // Filter groups that have at least one partner matching contactFilter
    if (contactFilter === "whatsapp") {
      result = result.filter((g) => g.withWhatsApp > 0);
    } else if (contactFilter === "email") {
      result = result.filter((g) => g.withEmail > 0);
    }

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
  }, [countryGroups, search, sortBy, filterMode, contactFilter]);

  // Get filtered partner list for "select all" in current view
  const visiblePartnerIds = useMemo(() => {
    const ids: string[] = [];
    filteredGroups.forEach((g) => {
      g.partners.forEach((p) => {
        if (contactFilter === "whatsapp" && !hasWhatsApp(p)) return;
        if (contactFilter === "email" && !hasEmail(p)) return;
        ids.push(p.id);
      });
    });
    return ids;
  }, [filteredGroups, contactFilter]);

  const allVisibleSelected = visiblePartnerIds.length > 0 && visiblePartnerIds.every((id) => selectedIds.has(id));

  const totalPartners = partners?.length || 0;
  const totalWithContacts = useMemo(
    () => (partners || []).filter((p) => {
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
      {/* Header */}
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

        {/* Contact filter toggles */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setContactFilter(contactFilter === "whatsapp" ? "all" : "whatsapp")}
            className={cn(
              "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all",
              contactFilter === "whatsapp"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-muted border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </button>
          <button
            onClick={() => setContactFilter(contactFilter === "email" ? "all" : "email")}
            className={cn(
              "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all",
              contactFilter === "email"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <Mail className="w-3 h-3" />
            Email
          </button>
          {onSelectAllFiltered && (
            <button
              onClick={() => onSelectAllFiltered(allVisibleSelected ? [] : visiblePartnerIds)}
              className={cn(
                "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ml-auto",
                allVisibleSelected
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <CheckSquare className="w-3 h-3" />
              {allVisibleSelected ? "Deseleziona" : "Sel. tutti"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
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
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as typeof filterMode)}>
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

            // Filter partners within group by contactFilter
            const visiblePartners = group.partners.filter((p) => {
              if (contactFilter === "whatsapp") return hasWhatsApp(p);
              if (contactFilter === "email") return hasEmail(p);
              return true;
            });

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
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              completePct >= 75 ? "bg-emerald-500" : completePct >= 40 ? "bg-primary" : "bg-destructive"
                            )}
                            style={{ width: `${completePct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{completePct}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      {contactFilter !== "all" && (
                        <div className="text-right">
                          <p className="text-sm font-semibold text-primary">{visiblePartners.length}</p>
                          <p className="text-[10px] text-muted-foreground">filtrati</p>
                        </div>
                      )}
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
                    {visiblePartners
                      .sort((a, b) => a.company_name.localeCompare(b.company_name))
                      .map((partner) => {
                        const q = getPartnerContactQuality(partner.partner_contacts);
                        const contactCount = (partner.partner_contacts || []).length;
                        const pHasWhatsApp = hasWhatsApp(partner);
                        const pHasEmail = hasEmail(partner);
                        const isSelected = selectedIds.has(partner.id);

                        return (
                          <div
                            key={partner.id}
                            onClick={() => onSelectPartner(partner.id)}
                            className={cn(
                              "pl-8 pr-3 py-2 hover:bg-accent/50 transition-colors cursor-pointer flex items-center gap-2",
                              selectedId === partner.id && "bg-accent",
                              isSelected && "bg-primary/5",
                              q === "missing" && "border-l-4 border-l-destructive",
                              q === "partial" && "border-l-4 border-l-primary",
                              q === "complete" && "border-l-4 border-l-primary",
                            )}
                          >
                            {onToggleSelection && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSelection(partner.id);
                                }}
                                className="shrink-0"
                              >
                                <Checkbox checked={isSelected} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{partner.company_name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {partner.city}
                                </span>
                                {partner.rating > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Star className="w-3 h-3 fill-primary text-primary" />
                                    {partner.rating.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {pHasWhatsApp && (
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                              {pHasEmail && (
                                <Mail className="w-3.5 h-3.5 text-primary" />
                              )}
                              {q === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                              {q === "partial" && <AlertTriangle className="w-4 h-4 text-primary" />}
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
