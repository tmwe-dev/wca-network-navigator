import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, CreditCard, Brain, Send, Search, RefreshCw, CheckSquare, Plane,
  LayoutList, LayoutGrid, Rows3, Mail, Phone, SlidersHorizontal,
  ChevronLeft, ChevronRight, Globe, ArrowUpAZ, ArrowDownAZ, Users, Star,
  MessageCircle, Loader2,
} from "lucide-react";
import { UnifiedBulkActionBar } from "@/components/shared/UnifiedBulkActionBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useBusinessCards, type BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { useSendToCockpit } from "@/hooks/useCockpitContacts";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { DeepSearchCanvas } from "@/components/operations/DeepSearchCanvas";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { createLogger } from "@/lib/log";

const log = createLogger("BusinessCardsView");

type ViewMode = "compact" | "card" | "expanded";
type SortMode = "name_asc" | "name_desc" | "contacts_desc" | "matched_first";

interface BcaGroup {
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

interface CountryEntry {
  code: string | null;
  label: string;
  flag: string;
  companyCount: number;
  contactCount: number;
}

function guessCountryFromLocation(location: string | null, phone: string | null): string | null {
  if (!location && !phone) return null;
  if (location) {
    const loc = location.toLowerCase();
    const map: Record<string, string> = {
      india: "IN", china: "CN", cina: "CN", usa: "US", "united states": "US",
      brazil: "BR", "united kingdom": "UK", uk: "GB", turkey: "TR", turchia: "TR",
      singapore: "SG", bangladesh: "BD", korea: "KR", "saudi arabia": "SA",
      messico: "MX", mexico: "MX", germany: "DE", germania: "DE", france: "FR",
      francia: "FR", italia: "IT", italy: "IT", spain: "ES", spagna: "ES",
      japan: "JP", giappone: "JP", australia: "AU", canada: "CA",
    };
    for (const [name, code] of Object.entries(map)) {
      if (loc.includes(name)) return code;
    }
  }
  if (phone) {
    const clean = phone.replace(/[^+\d]/g, "");
    const prefixes: Record<string, string> = {
      "+91": "IN", "+86": "CN", "+1": "US", "+55": "BR", "+44": "GB",
      "+90": "TR", "+65": "SG", "+88": "BD", "+82": "KR", "+966": "SA",
      "+52": "MX", "+49": "DE", "+33": "FR", "+39": "IT", "+34": "ES",
      "+81": "JP", "+61": "AU",
    };
    for (const [prefix, code] of Object.entries(prefixes)) {
      if (clean.startsWith(prefix)) return code;
    }
  }
  return null;
}

function countryCodeToFlag(code: string | null): string {
  if (!code || code.length !== 2) return "🌍";
  const upper = code.toUpperCase();
  const codePoints = upper.split("").map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function BusinessCardsView() {
  const { data: cards = [], isLoading } = useBusinessCards();
  const qc = useQueryClient();
  const sendToCockpit = useSendToCockpit();
  const deepSearch = useDeepSearch();
  const navigate = useNavigate();
  const { handleSendEmail, handleSendWhatsApp, waSending, waAvailable } = useDirectContactActions();
  const [selectedBca, setSelectedBca] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [sortMode, setSortMode] = useState<SortMode>("matched_first");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null); // null = all
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [onlyMatched, setOnlyMatched] = useState(false);
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await invokeEdge<any>("sync-business-cards", { context: "BusinessCardsView.sync_business_cards" });
      toast.success(`Sincronizzazione completata: ${data?.upserted ?? 0} biglietti aggiornati`);
      qc.invalidateQueries({ queryKey: ["business-cards"] });
    } catch (e: any) {
      toast.error("Errore sincronizzazione: " + (e.message || "sconosciuto"));
    } finally {
      setSyncing(false);
    }
  };

  const [hideHolding, setHideHolding] = useState(true);

  // Assign country to each card
  const cardsWithCountry = useMemo(() => {
    return cards.map(c => ({
      ...c,
      _country: c.partner?.country_code || guessCountryFromLocation(c.location, c.phone || c.mobile),
    }));
  }, [cards]);

  // Build country list
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

  // Filter by country + search + toggles
  const filtered = useMemo(() => {
    let list = cardsWithCountry;
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

  // Build groups
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
          hasDeepSearch: !!partner?.enrichment_data?.deep_search_at,
          isMatched: !!card.matched_partner_id,
          inHolding: !!(card.lead_status && card.lead_status !== "new"),
          partnerId: card.matched_partner_id || null,
          countryCode: (card as any)._country || null,
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

  const allFilteredIds = useMemo(() => filtered.map(c => c.id), [filtered]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedBca.has(id));

  const toggleBca = (id: string) => {
    setSelectedBca(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    setSelectedBca(allSelected ? new Set() : new Set(allFilteredIds));
  };

  const handleSendToCockpit = async () => {
    const items = Array.from(selectedBca).map(id => ({
      sourceType: "business_card",
      sourceId: id,
      partnerId: cards.find(c => c.id === id)?.matched_partner_id || undefined,
    }));
    try {
      const count = await sendToCockpit.mutateAsync(items);
      toast.success(`${count} biglietti inviati al Cockpit`);
      setSelectedBca(new Set());
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nell'invio al Cockpit"); }
  };

  const handleBcaDeepSearch = () => {
    const partnerIds = new Set<string>();
    for (const id of selectedBca) {
      const card = cards.find(c => c.id === id);
      if (card?.matched_partner_id) partnerIds.add(card.matched_partner_id);
    }
    if (partnerIds.size === 0) { toast.warning("Nessun biglietto associato a un partner."); return; }
    deepSearch.start(Array.from(partnerIds), true);
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* ═══ LEFT SIDEBAR: Countries ═══ */}
      <div className={cn(
        "flex-shrink-0 border-r border-border/40 bg-muted/20 flex flex-col transition-all duration-200 overflow-hidden",
        sidebarOpen ? "w-52" : "w-0"
      )}>
        {sidebarOpen && (
          <>
            {/* Sidebar header */}
            <div className="px-3 pt-3 pb-2 border-b border-border/30 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" /> Paesi
              </span>
              <span className="text-[10px] text-muted-foreground">{countries.length}</span>
            </div>

            {/* "All" item */}
            <button
              onClick={() => setSelectedCountry(null)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-left border-b border-border/20 transition-all",
                selectedCountry === null ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground"
              )}
            >
              <span className="text-sm">🌍</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">Tutti</div>
                <div className="text-[9px] text-muted-foreground">{totalCompanies} aziende · {cards.length} contatti</div>
              </div>
            </button>

            {/* Country list */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {countries.map(c => {
                const isActive = selectedCountry === (c.code ?? "__none__");
                return (
                  <button
                    key={c.code ?? "__none__"}
                    onClick={() => setSelectedCountry(c.code ?? "__none__")}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all border-b border-border/10",
                      isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground"
                    )}
                  >
                    <span className="text-base leading-none flex-shrink-0">{c.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium truncate">{c.label}</div>
                      <div className="text-[9px] text-muted-foreground">
                        {c.companyCount} az. · {c.contactCount} cont.
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sidebar filters */}
            <div className="border-t border-border/30 p-3 space-y-2.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" /> Filtri
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Solo WCA match</span>
                  <Switch checked={onlyMatched} onCheckedChange={setOnlyMatched} className="scale-[0.65]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Solo con email</span>
                  <Switch checked={onlyWithEmail} onCheckedChange={setOnlyWithEmail} className="scale-[0.65]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Plane className="w-3 h-3" /> Nascondi in circuito ({holdingCount})</span>
                  <Switch checked={hideHolding} onCheckedChange={setHideHolding} className="scale-[0.65]" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Ordina per</span>
                <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matched_first" className="text-xs">Match prima</SelectItem>
                    <SelectItem value="name_asc" className="text-xs">Nome A→Z</SelectItem>
                    <SelectItem value="name_desc" className="text-xs">Nome Z→A</SelectItem>
                    <SelectItem value="contacts_desc" className="text-xs">Contatti ↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Visualizzazione</span>
                <div className="flex items-center gap-1">
                  {([["compact", LayoutList, "Compatta"], ["card", LayoutGrid, "Griglia"], ["expanded", Rows3, "Espansa"]] as const).map(([mode, Icon, label]) => (
                    <TooltipProvider key={mode} delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => setViewMode(mode)} className={cn("p-1.5 rounded-md transition-all", viewMode === mode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40")}>
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-[10px]">{label}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(p => !p)}
        className="flex-shrink-0 w-5 flex items-center justify-center border-r border-border/30 hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
      >
        {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col px-4 pb-3 gap-3 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 pt-3 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca biglietto..." className="w-full h-8 pl-8 pr-3 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
          </div>
          <button onClick={toggleAll} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all", allSelected ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50")}>
            <CheckSquare className="w-3.5 h-3.5" /> {allSelected ? "Deseleziona" : "Seleziona tutti"}
          </button>
          <span className="text-xs text-muted-foreground">
            {filtered.length} biglietti · {groups.length} aziende
            {selectedBca.size > 0 && <span className="ml-1 text-amber-500">· {selectedBca.size} sel.</span>}
          </span>
          {selectedBca.size > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <UnifiedBulkActionBar
                count={selectedBca.size}
                sourceType="business_card"
                onClear={() => setSelectedBca(new Set())}
                onCockpit={handleSendToCockpit}
                onDeepSearch={handleBcaDeepSearch}
                onWorkspace={() => {
                  const selected = filtered.filter(c => selectedBca.has(c.id) && c.email);
                  if (selected.length === 0) { toast.warning("Nessun contatto con email"); return; }
                  navigate("/email-composer", {
                    state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) },
                  });
                }}
                onLinkedIn={() => {
                  const selected = filtered.filter(c => selectedBca.has(c.id));
                  const first = selected.find(c => c.contact_name);
                  if (first) {
                    const query = `${first.contact_name} ${first.company_name || ""} LinkedIn`;
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
                  }
                }}
                onCampaign={() => {
                  const selected = filtered.filter(c => selectedBca.has(c.id) && c.email);
                  if (selected.length === 0) { toast.warning("Nessun contatto con email"); return; }
                  navigate("/email-composer", {
                    state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) },
                  });
                }}
                withEmail={filtered.filter(c => selectedBca.has(c.id) && c.email).length}
                withPhone={filtered.filter(c => selectedBca.has(c.id) && (c.phone || c.mobile)).length}
              />
            </div>
          )}
          <Button size="sm" className="h-7 text-xs gap-1.5 ml-auto" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} /> {syncing ? "Sync..." : "Sincronizza"}
          </Button>
        </div>

        <DeepSearchCanvas open={deepSearch.canvasOpen} onClose={() => deepSearch.setCanvasOpen(false)} onStop={() => deepSearch.stop()} current={deepSearch.current} results={deepSearch.results} running={deepSearch.running} isDark={true} />

        {/* Card list */}
        <div className="flex-1 min-h-0 overflow-auto">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <CreditCard className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground/60">Nessun biglietto da visita</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => (
                <div key={group.key} className={cn("rounded-xl border overflow-hidden transition-all", group.isMatched ? "border-amber-500/30 bg-amber-500/[0.03]" : "border-border/60 bg-card/40")}>
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border", group.isMatched ? "border-amber-500/30 bg-amber-500/10" : "border-border/40 bg-muted/30")}>
                      {group.logoUrl ? <img src={group.logoUrl} alt="" className="w-7 h-7 rounded object-contain" /> : <Building2 className={cn("w-4 h-4", group.isMatched ? "text-amber-500/60" : "text-muted-foreground/40")} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {group.countryCode && <span className="text-lg leading-none flex-shrink-0">{countryCodeToFlag(group.countryCode)}</span>}
                        <span className="text-sm font-semibold text-foreground truncate">{group.companyName}</span>
                        {group.isMatched && <Badge variant="outline" className="text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/30 flex-shrink-0">WCA</Badge>}
                        {group.hasDeepSearch && <Brain className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" />}
                        {group.inHolding && <span title="In circuito di attesa"><Plane className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 animate-pulse" /></span>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{group.cards.length} contatt{group.cards.length === 1 ? "o" : "i"}</span>
                    </div>
                    <button onClick={() => {
                      const ids = group.cards.map(c => c.id);
                      const allInGroup = ids.every(id => selectedBca.has(id));
                      setSelectedBca(prev => { const next = new Set(prev); ids.forEach(id => allInGroup ? next.delete(id) : next.add(id)); return next; });
                    }} className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border/30 hover:bg-muted/40 transition-all">
                      {group.cards.every(c => selectedBca.has(c.id)) ? "Deseleziona" : "Seleziona"}
                    </button>
                  </div>

                  {/* Cards rendering by viewMode */}
                  {viewMode === "compact" ? (
                    <div className="divide-y divide-border/20">
                      {group.cards.map(card => {
                        const isSelected = selectedBca.has(card.id);
                        return (
                          <div key={card.id} className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all", isSelected ? "bg-amber-500/[0.06]" : "hover:bg-muted/20")} onClick={() => toggleBca(card.id)}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleBca(card.id)} className="w-3 h-3" />
                            <span className="text-xs font-medium text-foreground truncate flex-1">{card.contact_name || "—"}</span>
                            {card.position && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{card.position}</span>}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {card.email && (
                                <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><button onClick={(e) => { e.stopPropagation(); handleSendEmail({ email: card.email!, name: card.contact_name || undefined, company: group.companyName }); }} className="hover:scale-110 transition-transform"><Mail className="w-3 h-3 text-primary/60 hover:text-primary" /></button></TooltipTrigger><TooltipContent className="text-[10px]">Invia email a {card.email}</TooltipContent></Tooltip></TooltipProvider>
                              )}
                              {(card.phone || card.mobile) && (
                                <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><button onClick={(e) => { e.stopPropagation(); handleSendWhatsApp({ phone: (card.mobile || card.phone)!, contactName: card.contact_name || undefined, companyName: group.companyName, sourceType: "contact", sourceId: card.id }); }} className="hover:scale-110 transition-transform"><MessageCircle className="w-3 h-3 text-emerald-500/60 hover:text-emerald-500" /></button></TooltipTrigger><TooltipContent className="text-[10px]">WhatsApp {card.mobile || card.phone}</TooltipContent></Tooltip></TooltipProvider>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : viewMode === "expanded" ? (
                    <div className="space-y-2 p-3">
                      {group.cards.map(card => {
                        const isSelected = selectedBca.has(card.id);
                        return (
                          <div key={card.id} className={cn("relative rounded-lg border p-4 cursor-pointer transition-all hover:shadow-sm", isSelected ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-border/40 bg-card/30 hover:border-border/60")} onClick={() => toggleBca(card.id)}>
                            <div className="absolute top-2 right-2"><Checkbox checked={isSelected} onCheckedChange={() => toggleBca(card.id)} className="w-3.5 h-3.5" /></div>
                            <div className="space-y-2 pr-6">
                              <div className="text-sm font-semibold text-foreground">{card.contact_name || "—"}</div>
                              {card.position && <div className="text-xs text-muted-foreground">{card.position}</div>}
                              <div className="flex flex-wrap gap-2 mt-1">
                                {card.email && <button onClick={(e) => { e.stopPropagation(); handleSendEmail({ email: card.email!, name: card.contact_name || undefined, company: group.companyName }); }} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-mono hover:bg-primary/20 transition-colors cursor-pointer">{card.email}</button>}
                                {(card.phone || card.mobile) && <button onClick={(e) => { e.stopPropagation(); handleSendWhatsApp({ phone: (card.mobile || card.phone)!, contactName: card.contact_name || undefined, companyName: group.companyName, sourceType: "contact", sourceId: card.id }); }} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono hover:bg-emerald-500/20 transition-colors cursor-pointer">{card.mobile || card.phone}</button>}
                              </div>
                              {card.event_name && <div className="text-[10px] text-muted-foreground/60 mt-1">📍 {card.event_name}</div>}
                              {card.location && <div className="text-[10px] text-muted-foreground/60">📌 {card.location}</div>}
                              {card.notes && <div className="text-[10px] text-muted-foreground/50 italic mt-1">{card.notes}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
                      {group.cards.map(card => {
                        const isSelected = selectedBca.has(card.id);
                        return (
                          <div key={card.id} className={cn("relative rounded-lg border p-3 cursor-pointer transition-all duration-150 hover:shadow-sm", isSelected ? "border-amber-500/40 bg-amber-500/[0.06] shadow-[0_0_8px_rgba(245,158,11,0.1)]" : "border-border/40 bg-card/30 hover:border-border/60")} onClick={() => toggleBca(card.id)}>
                            <div className="absolute top-2 right-2"><Checkbox checked={isSelected} onCheckedChange={() => toggleBca(card.id)} className="w-3.5 h-3.5" /></div>
                            <div className="space-y-1.5 pr-6">
                              <div className="text-xs font-semibold text-foreground truncate">{card.contact_name || "—"}</div>
                              {card.position && <div className="text-[10px] text-muted-foreground truncate">{card.position}</div>}
                              <div className="flex items-center gap-1 mt-1">
                                {card.email && (
                                  <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><button onClick={(e) => { e.stopPropagation(); handleSendEmail({ email: card.email!, name: card.contact_name || undefined, company: group.companyName }); }} className="hover:scale-110 transition-transform"><Mail className="w-3 h-3 text-primary/60 hover:text-primary" /></button></TooltipTrigger><TooltipContent className="text-[10px]">Invia email a {card.email}</TooltipContent></Tooltip></TooltipProvider>
                                )}
                                {(card.phone || card.mobile) && (
                                  <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><button onClick={(e) => { e.stopPropagation(); handleSendWhatsApp({ phone: (card.mobile || card.phone)!, contactName: card.contact_name || undefined, companyName: group.companyName, sourceType: "contact", sourceId: card.id }); }} className="hover:scale-110 transition-transform"><MessageCircle className="w-3 h-3 text-emerald-500/60 hover:text-emerald-500" /></button></TooltipTrigger><TooltipContent className="text-[10px]">WhatsApp {card.mobile || card.phone}</TooltipContent></Tooltip></TooltipProvider>
                                )}
                              </div>
                              {card.event_name && <div className="text-[9px] text-muted-foreground/60 truncate mt-1">📍 {card.event_name}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
