import { useState, useMemo, useRef } from "react";
import { Search, Users, Globe, CreditCard, UserPlus, ChevronRight, Mail, X, ArrowUpDown, Check, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMission } from "@/contexts/MissionContext";
import { useQuery } from "@tanstack/react-query";
import { getCountryFlag } from "@/lib/countries";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";

type PickerTab = "partners" | "contacts" | "bca";
type CountrySort = "name" | "count";

const TABS: { value: PickerTab; label: string; icon: typeof Users }[] = [
  { value: "partners", label: "Partner", icon: Globe },
  { value: "contacts", label: "Contatti", icon: Users },
  { value: "bca", label: "BCA", icon: CreditCard },
];

export function EmailComposerContactPicker({ onConfirm }: { onConfirm?: () => void }) {
  const [tab, setTab] = useState<PickerTab>("partners");
  const [search, setSearch] = useState("");
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countrySort, setCountrySort] = useState<CountrySort>("count");
  const [hideHolding, setHideHolding] = useState(true);
  const { addRecipient, recipients, removeRecipient } = useMission();
  const scrollRef = useRef<HTMLDivElement>(null);

  const shouldSearch = search.length >= 3 || !!selectedCountry;

  // Country stats
  const { data: countryStats = [] } = useQuery({
    queryKey: ["picker-country-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("country_code")
        .not("country_code", "is", null);
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach(r => { const cc = r.country_code!; counts[cc] = (counts[cc] || 0) + 1; });
      return Object.entries(counts)
        .map(([code, count]) => ({
          code,
          count,
          flag: getCountryFlag(code),
          name: WCA_COUNTRIES_MAP[code]?.name || code,
        }));
    },
  });

  const sortedCountries = useMemo(() => {
    const copy = [...countryStats];
    if (countrySort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    else copy.sort((a, b) => b.count - a.count);
    return copy;
  }, [countryStats, countrySort]);

  // Partners search
  const { data: partners = [] } = useQuery({
    queryKey: ["picker-partners", search, selectedCountry],
    enabled: tab === "partners" && shouldSearch,
    queryFn: async () => {
      let q = supabase
        .from("partners")
        .select("id, company_name, company_alias, country_code, city, lead_status");
      if (search.length >= 3) q = q.ilike("company_name", `%${search}%`);
      if (selectedCountry) q = q.eq("country_code", selectedCountry);
      const { data } = await q.order("company_name").limit(50);
      return data || [];
    },
  });

  // Partner contacts (when expanded)
  const { data: partnerContacts = [] } = useQuery({
    queryKey: ["picker-partner-contacts", expandedPartner],
    enabled: !!expandedPartner,
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_contacts")
        .select("id, name, contact_alias, email, title")
        .eq("partner_id", expandedPartner!)
        .order("is_primary", { ascending: false });
      return data || [];
    },
  });

  // Imported contacts search
  const { data: contacts = [] } = useQuery({
    queryKey: ["picker-contacts", search],
    enabled: tab === "contacts" && shouldSearch,
    queryFn: async () => {
      const { data } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, country, contact_alias, company_alias, lead_status")
        .or(`name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(30);
      return data || [];
    },
  });

  // Business cards search
  const { data: bcaCards = [] } = useQuery({
    queryKey: ["picker-bca", search],
    enabled: tab === "bca" && shouldSearch,
    queryFn: async () => {
      const { data } = await supabase
        .from("business_cards")
        .select("id, contact_name, company_name, email, location, matched_partner_id, lead_status")
        .or(`contact_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(30);
      return data || [];
    },
  });

  // Filter out holding pattern contacts
  const filteredPartners = useMemo(() =>
    hideHolding ? partners.filter(p => !p.lead_status || p.lead_status === 'new') : partners,
    [partners, hideHolding]
  );
  const filteredContacts = useMemo(() =>
    hideHolding ? contacts.filter(c => !c.lead_status || c.lead_status === 'new') : contacts,
    [contacts, hideHolding]
  );
  const filteredBca = useMemo(() =>
    hideHolding ? bcaCards.filter(c => !(c as any).lead_status || (c as any).lead_status === 'new') : bcaCards,
    [bcaCards, hideHolding]
  );

  const isSelected = (partnerId: string, contactId?: string) => {
    return recipients.some(r =>
      r.partnerId === partnerId && (contactId ? r.contactId === contactId : !r.contactId)
    );
  };

  const handleSelectPartner = (p: typeof partners[0]) => {
    if (isSelected(p.id)) return;
    addRecipient({
      partnerId: p.id,
      companyName: p.company_name || "",
      companyAlias: (p as any).company_alias || undefined,
      email: null,
      city: p.city || "",
      countryName: WCA_COUNTRIES_MAP[p.country_code || ""]?.name || p.country_code || "",
      countryCode: p.country_code || undefined,
      isEnriched: false,
    });
  };

  const handleSelectContact = (partnerId: string, companyName: string, companyAlias: string | undefined, countryCode: string | undefined, c: typeof partnerContacts[0]) => {
    if (isSelected(partnerId, c.id)) return;
    addRecipient({
      partnerId,
      companyName,
      companyAlias,
      contactId: c.id,
      contactName: c.name,
      contactAlias: (c as any).contact_alias || undefined,
      email: c.email,
      city: "",
      countryName: "",
      countryCode: countryCode || undefined,
      isEnriched: !!c.email,
    });
  };

  const handleSelectImported = (c: typeof contacts[0]) => {
    if (isSelected(c.id)) return;
    addRecipient({
      partnerId: c.id,
      companyName: c.company_name || "",
      companyAlias: (c as any).company_alias || undefined,
      contactName: c.name || undefined,
      contactAlias: (c as any).contact_alias || undefined,
      email: c.email,
      city: "",
      countryName: c.country || "",
      isEnriched: !!c.email,
    });
  };

  const handleSelectBca = (c: typeof bcaCards[0]) => {
    const pid = c.matched_partner_id || c.id;
    if (isSelected(pid)) return;
    addRecipient({
      partnerId: pid,
      companyName: c.company_name || "",
      contactName: c.contact_name || undefined,
      email: c.email,
      city: c.location || "",
      countryName: "",
      isEnriched: !!c.email,
    });
  };

  return (
    <div className="space-y-3">
      {/* Country flag carousel - bigger with names */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Globe className="w-3 h-3" /> Paesi
          </label>
          <button
            onClick={() => setCountrySort(s => s === "count" ? "name" : "count")}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground"
            title={countrySort === "count" ? "Ordina per nome" : "Ordina per numero"}
          >
            <ArrowUpDown className="w-2.5 h-2.5" />
            {countrySort === "count" ? "N°" : "A-Z"}
          </button>
        </div>
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin"
          style={{ scrollbarWidth: "thin" }}
        >
          {selectedCountry && (
            <button
              onClick={() => setSelectedCountry(null)}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[9px] font-medium border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 min-w-[48px]"
            >
              <span className="text-base">✕</span>
              <span>Tutti</span>
            </button>
          )}
          {sortedCountries.map(c => (
            <button
              key={c.code}
              onClick={() => setSelectedCountry(selectedCountry === c.code ? null : c.code)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all border min-w-[48px]",
                selectedCountry === c.code
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "border-border/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <span className="text-lg leading-none">{c.flag}</span>
              <span className="tabular-nums font-bold">{c.count}</span>
              <span className="truncate max-w-[52px] text-[8px]">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected recipients + confirm */}
      {recipients.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <UserPlus className="w-3 h-3" /> Selezionati ({recipients.length})
            </label>
            {onConfirm && (
              <Button onClick={onConfirm} size="sm" className="h-6 gap-1 text-[10px] px-2.5">
                <Check className="w-3 h-3" /> Conferma
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
            {recipients.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                <span className="text-xs leading-none">{getCountryFlag(r.countryCode || "")}</span>
                {r.contactAlias || r.contactName || r.companyAlias || r.companyName}
                {r.email && <Mail className="w-2.5 h-2.5 opacity-60" />}
                <button onClick={() => removeRecipient(i)} className="hover:text-destructive">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toggle nascondi in circuito */}
      <div className="flex items-center justify-between py-1.5 px-1">
        <label className="text-[10px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
          <Plane className="w-3 h-3" /> Nascondi in circuito
        </label>
        <Switch checked={hideHolding} onCheckedChange={setHideHolding} className="scale-75" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => { setTab(t.value); setSearch(""); setExpandedPartner(null); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
              tab === t.value
                ? "bg-primary/15 border-primary/30 text-primary"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            )}
          >
            <t.icon className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca (min. 3 caratteri)..."
          className="h-8 text-xs bg-muted/30 border-border/40 pl-8"
        />
      </div>

      {/* Results */}
      <ScrollArea className="max-h-[400px]">
        {!shouldSearch && (
          <p className="text-[11px] text-muted-foreground text-center py-4">
            Seleziona un paese o digita almeno 3 caratteri
          </p>
        )}

        {/* Partners */}
        {tab === "partners" && shouldSearch && (
         <div className="space-y-0.5">
            {filteredPartners.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Nessun risultato</p>}
            {filteredPartners.map(p => (
              <div key={p.id}>
                <button
                  onClick={() => setExpandedPartner(expandedPartner === p.id ? null : p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all hover:bg-muted/40",
                    expandedPartner === p.id && "bg-muted/30"
                  )}
                >
                  <ChevronRight className={cn("w-3 h-3 transition-transform flex-shrink-0", expandedPartner === p.id && "rotate-90")} />
                  <span className="flex-1 text-left truncate font-medium">{p.company_name}</span>
                  {p.country_code && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{p.country_code}</Badge>}
                  {!isSelected(p.id) && (
                    <button
                      onClick={e => { e.stopPropagation(); handleSelectPartner(p); }}
                      className="text-[9px] text-primary hover:underline flex-shrink-0"
                    >
                      +Azienda
                    </button>
                  )}
                  {isSelected(p.id) && <Badge className="text-[8px] h-3.5 px-1 bg-primary/20 text-primary border-0">✓</Badge>}
                </button>
                {expandedPartner === p.id && partnerContacts.length > 0 && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-primary/20 pl-2">
                    {partnerContacts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectContact(p.id, p.company_name || "", (p as any).company_alias || undefined, p.country_code || undefined, c)}
                        disabled={isSelected(p.id, c.id)}
                        className={cn(
                          "w-full flex flex-col gap-0.5 px-2 py-1.5 rounded text-left transition-all",
                          isSelected(p.id, c.id) ? "opacity-50" : "hover:bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="flex-1 truncate text-[11px] font-medium">{c.name}</span>
                          {c.email && <Mail className="w-3 h-3 text-primary/60 flex-shrink-0" />}
                          {isSelected(p.id, c.id)
                            ? <span className="text-primary text-[9px]">✓</span>
                            : <span className="text-primary text-[9px]">+</span>
                          }
                        </div>
                        {c.title && (
                          <span className="text-[10px] text-muted-foreground pl-0">{c.title}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {expandedPartner === p.id && partnerContacts.length === 0 && (
                  <p className="ml-7 text-[10px] text-muted-foreground py-1">Nessun contatto</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Imported contacts */}
        {tab === "contacts" && shouldSearch && (
          <div className="space-y-0.5">
            {contacts.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Nessun risultato</p>}
            {contacts.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectImported(c)}
                disabled={isSelected(c.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all",
                  isSelected(c.id) ? "opacity-50 bg-muted/20" : "hover:bg-muted/40"
                )}
              >
                <span className="flex-1 text-left truncate font-medium">{c.name || c.company_name}</span>
                {c.company_name && c.name && <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">{c.company_name}</span>}
                {c.email && <Mail className="w-3 h-3 text-primary/60" />}
                {isSelected(c.id) ? <span className="text-primary text-[9px]">✓</span> : <span className="text-primary text-[9px]">+</span>}
              </button>
            ))}
          </div>
        )}

        {/* BCA */}
        {tab === "bca" && shouldSearch && (
          <div className="space-y-0.5">
            {bcaCards.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Nessun risultato</p>}
            {bcaCards.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectBca(c)}
                disabled={isSelected(c.matched_partner_id || c.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all",
                  isSelected(c.matched_partner_id || c.id) ? "opacity-50 bg-muted/20" : "hover:bg-muted/40"
                )}
              >
                <span className="flex-1 text-left truncate font-medium">{c.contact_name || c.company_name}</span>
                {c.company_name && c.contact_name && <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">{c.company_name}</span>}
                {c.email && <Mail className="w-3 h-3 text-primary/60" />}
                {isSelected(c.matched_partner_id || c.id) ? <span className="text-primary text-[9px]">✓</span> : <span className="text-primary text-[9px]">+</span>}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Confirm button */}
      {recipients.length > 0 && onConfirm && (
        <div className="pt-3 border-t border-border mt-2">
          <Button onClick={onConfirm} className="w-full gap-2" size="sm">
            <Check className="w-4 h-4" />
            Conferma {recipients.length} destinatar{recipients.length === 1 ? "io" : "i"}
          </Button>
        </div>
      )}
    </div>
  );
}
