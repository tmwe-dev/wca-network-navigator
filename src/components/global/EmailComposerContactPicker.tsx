import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Users, Globe, CreditCard, UserPlus, ChevronRight, Mail, X, ArrowUpDown, Check, Plane, ListChecks, Settings2, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { rpcGetCountryStats, rpcGetContactFilterOptions } from "@/data/rpc";
import { getCountryCodesBatched } from "@/data/partners";
import { useMission } from "@/contexts/MissionContext";
import { useQuery } from "@tanstack/react-query";
import { getCountryFlag } from "@/lib/countries";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";
import { createLogger } from "@/lib/log";

const log = createLogger("EmailComposerContactPicker");

type PickerTab = "partners" | "contacts" | "bca";
type CountrySort = "name" | "count";
type PartnerSort = "name" | "country" | "rating";
type ContactSort = "name" | "company" | "origin" | "country";
type BcaSort = "name" | "company" | "location";

const TABS: { value: PickerTab; label: string; icon: typeof Users }[] = [
  { value: "partners", label: "Partner", icon: Globe },
  { value: "contacts", label: "Contatti", icon: Users },
  { value: "bca", label: "BCA", icon: CreditCard },
];

export function EmailComposerContactPicker({ onConfirm }: { onConfirm?: () => void }) {
  const [tab, setTab] = useState<PickerTab>("partners");
  const [search, setSearch] = useState("");
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countrySort, setCountrySort] = useState<CountrySort>("count");
  const [hideHolding, setHideHolding] = useState(true);
  const [partnerSort, setPartnerSort] = useState<PartnerSort>("name");
  const [contactSort, setContactSort] = useState<ContactSort>("name");
  const [bcaSort, setBcaSort] = useState<BcaSort>("name");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const { addRecipient, recipients, removeRecipient, clearRecipients } = useMission();
  const contactsListRef = useRef<HTMLDivElement>(null);

  // shouldSearch is only used for UI hints, not to gate data
  const shouldSearch = search.length >= 3 || !!selectedCountry;
  const hasFilter = shouldSearch; // alias for clarity

  // ── Country stats — use RPC or aggregation to get REAL counts (no 1000 limit) ──
  const { data: countryStats = [] } = useQuery({
    queryKey: ["picker-country-stats-v2"],
    queryFn: async () => {
      // Use get_country_stats RPC if available, otherwise paginate
      try {
        const rpcData = await rpcGetCountryStats();
        if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          return rpcData
            .filter((r: any) => r.country_code)
            .map((r: any) => ({
              code: r.country_code,
              count: Number(r.total_partners || 0),
              flag: getCountryFlag(r.country_code),
              name: WCA_COUNTRIES_MAP[r.country_code]?.name || r.country_code,
            }));
        }
      } catch (e) {
        log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
        // fallback below
      }
      // Fallback: fetch all country_codes in batches to bypass 1000 limit
      const counts = await getCountryCodesBatched();
      return Object.entries(counts).map(([code, count]) => ({
        code, count,
        flag: getCountryFlag(code),
        name: WCA_COUNTRIES_MAP[code]?.name || code,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Origin options for contacts
  const { data: originOptions = [] } = useQuery({
    queryKey: ["picker-origin-options"],
    queryFn: async () => {
      const data = await rpcGetContactFilterOptions();
      if (!data) return [];
      return (data as any[])
        .filter((d: any) => d.filter_type === "origin" && d.filter_value)
        .map((d: any) => d.filter_value as string);
    },
  });

  const sortedCountries = useMemo(() => {
    const copy = [...countryStats];
    if (countrySort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    else copy.sort((a, b) => b.count - a.count);
    return copy;
  }, [countryStats, countrySort]);

  // ── Partners search ──
  const { data: partners = [] } = useQuery({
    queryKey: ["picker-partners", search, selectedCountry],
    enabled: tab === "partners",
    queryFn: async () => {
      let q = supabase
        .from("partners")
        .select("id, company_name, company_alias, country_code, city, lead_status");
      if (search.length >= 3) q = q.ilike("company_name", `%${search}%`);
      if (selectedCountry) q = q.eq("country_code", selectedCountry);
      q = q.eq("is_active", true);
      const { data } = await q.order("company_name").limit(200);
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

  // ── Imported contacts — search OR country filter ──
  const { data: contacts = [] } = useQuery({
    queryKey: ["picker-contacts", search, selectedCountry, originFilter],
    enabled: tab === "contacts",
    queryFn: async () => {
      let q = supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, country, contact_alias, company_alias, lead_status, origin, position");
      if (search.length >= 3) q = q.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`);
      if (selectedCountry) {
        // Country in imported_contacts is text (country name), map from code
        const countryName = WCA_COUNTRIES_MAP[selectedCountry]?.name;
        if (countryName) q = q.ilike("country", `%${countryName}%`);
      }
      if (originFilter !== "all") q = q.eq("origin", originFilter);
      const { data } = await q.limit(200);
      return data || [];
    },
  });

  // ── Business cards — search OR show all (no country filter needed) ──
  const { data: bcaCards = [] } = useQuery({
    queryKey: ["picker-bca", search, selectedCountry],
    enabled: tab === "bca",
    queryFn: async () => {
      let q = supabase
        .from("business_cards")
        .select("id, contact_name, company_name, email, location, matched_partner_id, lead_status");
      if (search.length >= 3) {
        q = q.or(`contact_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (selectedCountry) {
        const countryName = WCA_COUNTRIES_MAP[selectedCountry]?.name;
        if (countryName) q = q.ilike("location", `%${countryName}%`);
      }
      const { data } = await q.limit(200);
      return data || [];
    },
  });

  // Filter holding pattern
  const filteredPartners = useMemo(() => {
    let list = hideHolding ? partners.filter(p => p.lead_status !== 'holding_pattern') : partners;
    const sorted = [...list];
    switch (partnerSort) {
      case "name": sorted.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "")); break;
      case "country": sorted.sort((a, b) => (a.country_code || "").localeCompare(b.country_code || "")); break;
    }
    return sorted;
  }, [partners, hideHolding, partnerSort]);

  const filteredContacts = useMemo(() => {
    let list = hideHolding ? contacts.filter(c => c.lead_status !== 'holding_pattern') : contacts;
    const sorted = [...list];
    switch (contactSort) {
      case "name": sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
      case "company": sorted.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "")); break;
      case "origin": sorted.sort((a, b) => (a.origin || "").localeCompare(b.origin || "")); break;
      case "country": sorted.sort((a, b) => (a.country || "").localeCompare(b.country || "")); break;
    }
    return sorted;
  }, [contacts, hideHolding, contactSort]);

  // Group contacts by company
  const groupedContacts = useMemo(() => {
    const groups: Record<string, typeof filteredContacts> = {};
    filteredContacts.forEach(c => {
      const key = c.company_name || "Senza azienda";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredContacts]);

  const filteredBca = useMemo(() => {
    let list = hideHolding ? bcaCards.filter(c => (c as any).lead_status !== 'holding_pattern') : bcaCards;
    const sorted = [...list];
    switch (bcaSort) {
      case "name": sorted.sort((a, b) => (a.contact_name || "").localeCompare(b.contact_name || "")); break;
      case "company": sorted.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "")); break;
      case "location": sorted.sort((a, b) => (a.location || "").localeCompare(b.location || "")); break;
    }
    return sorted;
  }, [bcaCards, hideHolding, bcaSort]);

  const currentCount = tab === "partners" ? filteredPartners.length
    : tab === "contacts" ? filteredContacts.length
    : filteredBca.length;

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
      partnerId, companyName, companyAlias,
      contactId: c.id, contactName: c.name,
      contactAlias: (c as any).contact_alias || undefined,
      email: c.email, city: "",
      countryName: "", countryCode: countryCode || undefined,
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
      email: c.email, city: "",
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
      email: c.email, city: c.location || "",
      countryName: "", isEnriched: !!c.email,
    });
  };

  const handleSelectAll = () => {
    if (tab === "partners") filteredPartners.forEach(p => handleSelectPartner(p));
    else if (tab === "contacts") filteredContacts.forEach(c => handleSelectImported(c));
    else filteredBca.forEach(c => handleSelectBca(c));
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header: Tabs → Selected → Search ── */}
      <div className="flex-shrink-0 pb-1.5 mb-1 border-b border-border/30 space-y-1">
        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); setSearch(""); setExpandedPartner(null); setExpandedCompany(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                tab === t.value
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Selected recipients row */}
        <div className="flex items-center gap-1.5 min-h-[22px]">
          {recipients.length > 0 ? (
            <>
              <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-none min-w-0">
                {recipients.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-medium border border-primary/20 shrink-0 max-w-[140px]">
                    <span className="text-xs leading-none">{getCountryFlag(r.countryCode || "")}</span>
                    <span className="truncate">{r.contactAlias || r.contactName || r.companyAlias || r.companyName}</span>
                    <button onClick={() => removeRecipient(i)} className="hover:text-destructive ml-0.5">
                      <X className="w-2 h-2" />
                    </button>
                  </span>
                ))}
              </div>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">{recipients.length}</Badge>
              <Button onClick={clearRecipients} size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] text-muted-foreground shrink-0">
                <X className="w-2.5 h-2.5" />
              </Button>
            </>
          ) : (
            <span className="text-[9px] text-muted-foreground/50 italic">Nessun destinatario selezionato</span>
          )}
        </div>

        {/* Search + settings */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca (min. 3 caratteri)..."
            className="h-7 text-xs bg-muted/30 border-border/40 pl-8 pr-16"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {shouldSearch && (
              <span className="text-[9px] text-muted-foreground tabular-nums">{currentCount}</span>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "p-1 rounded hover:bg-muted/60 transition-colors",
                  (hideHolding || originFilter !== "all") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}>
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 space-y-3" align="end" side="bottom">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ordinamento</label>
                  <Select
                    value={tab === "partners" ? partnerSort : tab === "contacts" ? contactSort : bcaSort}
                    onValueChange={(v) => {
                      if (tab === "partners") setPartnerSort(v as PartnerSort);
                      else if (tab === "contacts") setContactSort(v as ContactSort);
                      else setBcaSort(v as BcaSort);
                    }}
                  >
                    <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tab === "partners" && <><SelectItem value="name">Nome</SelectItem><SelectItem value="country">Paese</SelectItem><SelectItem value="rating">Rating</SelectItem></>}
                      {tab === "contacts" && <><SelectItem value="name">Nome</SelectItem><SelectItem value="company">Azienda</SelectItem><SelectItem value="origin">Origine</SelectItem><SelectItem value="country">Paese</SelectItem></>}
                      {tab === "bca" && <><SelectItem value="name">Nome</SelectItem><SelectItem value="company">Azienda</SelectItem><SelectItem value="location">Location</SelectItem></>}
                    </SelectContent>
                  </Select>
                </div>
                {tab === "contacts" && originOptions.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Origine</label>
                    <Select value={originFilter} onValueChange={setOriginFilter}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Tutte" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte le origini</SelectItem>
                        {originOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <Plane className="w-3 h-3" /> Nascondi in circuito
                  </label>
                  <Switch checked={hideHolding} onCheckedChange={setHideHolding} className="scale-75" />
                </div>
                {shouldSearch && currentCount > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="w-full h-7 text-[10px] gap-1">
                    <ListChecks className="w-3 h-3" /> Seleziona tutti ({currentCount})
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* ── Main: Left country strip + Right results ── */}
      <div className="flex-1 flex min-h-0 gap-2">
        {/* Left: vertical country strip — wider */}
        <div className="flex-shrink-0 w-[80px] flex flex-col min-h-0">
          <div className="flex items-center justify-center mb-1">
            <button
              onClick={() => setCountrySort(s => s === "count" ? "name" : "count")}
              className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground"
              title={countrySort === "count" ? "Ordina per nome" : "Ordina per numero"}
            >
              <ArrowUpDown className="w-3 h-3" />
              {countrySort === "count" ? "N°" : "AZ"}
            </button>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col gap-1 pr-1">
              {selectedCountry && (
                <button
                  onClick={() => setSelectedCountry(null)}
                  className="flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg text-[9px] font-medium border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10"
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
                    "flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg text-[9px] font-medium transition-all border",
                    selectedCountry === c.code
                      ? "bg-primary/15 border-primary/40 text-primary ring-1 ring-primary/20"
                      : "border-border/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                   <span className="text-2xl leading-none">{c.flag}</span>
                    <span className="tabular-nums font-bold text-[11px]">{c.count}</span>
                    <span className="truncate w-full text-center text-[9px] leading-tight">{c.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: results — relative for overlay positioning */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative" ref={contactsListRef}>
          <ScrollArea className="flex-1 min-h-0">
            <div className="rounded-lg bg-muted/15 border border-border/20 p-1.5 min-h-[120px]">
              {/* Show hint only when no data and no filter */}
              {!shouldSearch && tab === "partners" && filteredPartners.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">
                  Seleziona un paese o digita almeno 3 caratteri
                </p>
              )}

              {/* ═══ Partners ═══ */}
              {tab === "partners" && (filteredPartners.length > 0 || shouldSearch) && (
                <div className="space-y-1.5">
                  {filteredPartners.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Nessun risultato</p>}
                  {filteredPartners.map(p => (
                    <div key={p.id} className="relative">
                      <div className={cn(
                        "rounded-lg border bg-card shadow-sm",
                        expandedPartner === p.id ? "border-primary/30" : "border-border/50"
                      )}>
                        <button
                          onClick={() => setExpandedPartner(expandedPartner === p.id ? null : p.id)}
                          className={cn(
                            "w-full flex items-start gap-2 px-3 py-2 text-xs transition-all hover:bg-muted/40 rounded-lg",
                            expandedPartner === p.id && "bg-muted/20"
                          )}
                        >
                          <ChevronRight className={cn("w-3 h-3 transition-transform flex-shrink-0 text-muted-foreground mt-0.5", expandedPartner === p.id && "rotate-90")} />
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-semibold text-foreground truncate text-[11px]">{p.company_name}</div>
                            {p.city && (
                              <div className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                <MapPin className="w-2.5 h-2.5 shrink-0" /> {p.city}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            {p.country_code && (
                              <span className="text-base leading-none" title={WCA_COUNTRIES_MAP[p.country_code]?.name || p.country_code}>
                                {getCountryFlag(p.country_code)}
                              </span>
                            )}
                            {!isSelected(p.id) ? (
                              <button
                                onClick={e => { e.stopPropagation(); handleSelectPartner(p); }}
                                className="text-[9px] text-primary font-medium hover:underline"
                              >+Azienda</button>
                            ) : (
                              <Check className="w-3.5 h-3.5 text-primary" />
                            )}
                          </div>
                        </button>
                      </div>
                      {/* Overlay for contacts — floats OVER list */}
                      {expandedPartner === p.id && (
                        <div className="absolute left-0 right-0 z-20 mt-0.5 rounded-lg border border-primary/30 bg-popover/98 backdrop-blur-sm shadow-lg p-2 space-y-0.5 max-h-[200px] overflow-y-auto">
                          {partnerContacts.length === 0 && (
                            <p className="text-[9px] text-muted-foreground py-1 px-1">Nessun contatto</p>
                          )}
                          {partnerContacts.map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleSelectContact(p.id, p.company_name || "", (p as any).company_alias || undefined, p.country_code || undefined, c)}
                              disabled={isSelected(p.id, c.id)}
                              className={cn(
                                "w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition-all",
                                isSelected(p.id, c.id) ? "opacity-50 bg-muted/20" : "hover:bg-primary/10"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-medium text-foreground truncate">{c.name}</div>
                                {c.title && <div className="text-[9px] text-muted-foreground truncate">{c.title}</div>}
                              </div>
                              {c.email && <Mail className="w-3 h-3 text-primary/60 flex-shrink-0 mt-0.5" />}
                              {isSelected(p.id, c.id)
                                ? <Check className="w-3 h-3 text-primary mt-0.5" />
                                : <span className="text-primary text-[9px] font-medium mt-0.5">+</span>
                              }
                            </button>
                          ))}
                          <button
                            onClick={() => setExpandedPartner(null)}
                            className="w-full text-center text-[9px] text-muted-foreground hover:text-foreground py-1 mt-0.5 border-t border-border/30"
                          >
                            Chiudi ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ═══ Imported contacts — grouped by company ═══ */}
              {tab === "contacts" && (
                <div className="space-y-1.5">
                  {filteredContacts.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Nessun risultato</p>}
                  {groupedContacts.map(([companyName, members]) => (
                    <div key={companyName} className="relative">
                      <div className={cn(
                        "rounded-lg border bg-card shadow-sm",
                        expandedCompany === companyName ? "border-primary/30" : "border-border/50"
                      )}>
                        {members.length === 1 ? (
                          <button
                            onClick={() => handleSelectImported(members[0])}
                            disabled={isSelected(members[0].id)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs transition-all rounded-lg",
                              isSelected(members[0].id) ? "opacity-50" : "hover:bg-muted/40"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-foreground truncate text-[11px]">{companyName !== "Senza azienda" ? companyName : (members[0].name || "—")}</div>
                                {members[0].name && companyName !== "Senza azienda" && (
                                  <div className="text-[10px] text-foreground/80 truncate">{members[0].name}</div>
                                )}
                                {members[0].position && (
                                  <div className="text-[9px] text-muted-foreground truncate">{members[0].position}</div>
                                )}
                                {members[0].country && (
                                  <div className="text-[8px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                    <MapPin className="w-2 h-2" /> {members[0].country}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 shrink-0">
                                {members[0].origin && <Badge variant="outline" className="text-[7px] h-3 px-1 border-border/40">{members[0].origin}</Badge>}
                                {members[0].email && <Mail className="w-3 h-3 text-primary/60" />}
                                {isSelected(members[0].id) ? <Check className="w-3 h-3 text-primary" /> : <span className="text-primary text-[9px]">+</span>}
                              </div>
                            </div>
                          </button>
                        ) : (
                          <button
                            onClick={() => setExpandedCompany(expandedCompany === companyName ? null : companyName)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-xs transition-all hover:bg-muted/40 rounded-lg",
                              expandedCompany === companyName && "bg-muted/20"
                            )}
                          >
                            <ChevronRight className={cn("w-3 h-3 transition-transform flex-shrink-0 text-muted-foreground", expandedCompany === companyName && "rotate-90")} />
                            <div className="flex-1 text-left min-w-0">
                              <div className="font-semibold text-foreground truncate text-[11px]">{companyName}</div>
                            </div>
                            <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{members.length}</Badge>
                          </button>
                        )}
                      </div>
                      {/* Overlay for multi-contact company */}
                      {members.length > 1 && expandedCompany === companyName && (
                        <div className="absolute left-0 right-0 z-20 mt-0.5 rounded-lg border border-primary/30 bg-popover/98 backdrop-blur-sm shadow-lg p-2 space-y-0.5 max-h-[200px] overflow-y-auto">
                          {members.map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleSelectImported(c)}
                              disabled={isSelected(c.id)}
                              className={cn(
                                "w-full text-left px-2 py-1.5 rounded-md transition-all",
                                isSelected(c.id) ? "opacity-50 bg-muted/20" : "hover:bg-primary/10"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] font-medium text-foreground truncate">{c.name || "—"}</div>
                                  {c.position && <div className="text-[9px] text-muted-foreground truncate">{c.position}</div>}
                                </div>
                                {c.email && <Mail className="w-3 h-3 text-primary/60 mt-0.5" />}
                                {isSelected(c.id) ? <Check className="w-3 h-3 text-primary mt-0.5" /> : <span className="text-primary text-[9px] mt-0.5">+</span>}
                              </div>
                            </button>
                          ))}
                          <button
                            onClick={() => setExpandedCompany(null)}
                            className="w-full text-center text-[9px] text-muted-foreground hover:text-foreground py-1 mt-0.5 border-t border-border/30"
                          >
                            Chiudi ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ═══ BCA ═══ */}
              {tab === "bca" && (
                <div className="space-y-1.5">
                  {filteredBca.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Nessun risultato</p>}
                  {filteredBca.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectBca(c)}
                      disabled={isSelected(c.matched_partner_id || c.id)}
                      className={cn(
                        "w-full text-left rounded-lg border border-border/50 bg-card px-3 py-2 text-xs transition-all shadow-sm",
                        isSelected(c.matched_partner_id || c.id) ? "opacity-50" : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate text-[11px]">{c.company_name || c.contact_name || "—"}</div>
                          {c.contact_name && c.company_name && (
                            <div className="text-[10px] text-foreground/80 truncate">{c.contact_name}</div>
                          )}
                          {c.location && (
                            <div className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                              <MapPin className="w-2.5 h-2.5" /> {c.location}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 shrink-0">
                          {c.email && <Mail className="w-3 h-3 text-primary/60" />}
                          {isSelected(c.matched_partner_id || c.id) ? <Check className="w-3 h-3 text-primary" /> : <span className="text-primary text-[9px]">+</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
