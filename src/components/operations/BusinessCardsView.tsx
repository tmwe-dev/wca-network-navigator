import { useState, useMemo } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import {
  Building2, CreditCard, Brain, Search, RefreshCw, CheckSquare, Plane,
  ChevronLeft, ChevronRight, Clock,
} from "lucide-react";
import { UnifiedBulkActionBar } from "@/components/shared/UnifiedBulkActionBar";
import { BCAQualityDashboard } from "./bca/BCAQualityDashboard";
import { BCAEventTimeline } from "./bca/BCAEventTimeline";
import { cn } from "@/lib/utils";
import { useBusinessCards } from "@/hooks/useBusinessCards";
import { useSendToCockpit } from "@/hooks/useCockpitContacts";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { DeepSearchCanvas } from "@/components/operations/DeepSearchCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { createLogger } from "@/lib/log";
import { useBcaGrouping } from "./bca/useBcaGrouping";
import { BcaCountrySidebar } from "./bca/BcaCountrySidebar";
import { BcaCompactCard, BcaGridCard, BcaExpandedCard } from "./bca/BcaCardRenderers";
import { countryCodeToFlag } from "./bca/bcaUtils";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("BusinessCardsView");

export function BusinessCardsView() {
  const { data: cards = [], isLoading } = useBusinessCards();
  const qc = useQueryClient();
  const sendToCockpit = useSendToCockpit();
  const deepSearch = useDeepSearch();
  const navigate = useAppNavigate();
  const { handleSendEmail, handleSendWhatsApp } = useDirectContactActions();
  const [selectedBca, setSelectedBca] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [timelineMode, setTimelineMode] = useState(false);

  const g = useBcaGrouping(cards);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await invokeEdge<Record<string, number>>("sync-business-cards", { context: "BusinessCardsView.sync_business_cards" });
      toast.success(`Sincronizzazione completata: ${data?.upserted ?? 0} biglietti aggiornati`);
      qc.invalidateQueries({ queryKey: queryKeys.businessCards.all });
    } catch (e: unknown) {
      toast.error("Errore sincronizzazione: " + (e instanceof Error ? e.message : "sconosciuto"));
    } finally {
      setSyncing(false);
    }
  };

  const allFilteredIds = useMemo(() => g.filtered.map(c => c.id), [g.filtered]);
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
      {/* Sidebar */}
      <div className={cn("flex-shrink-0 border-r border-border/40 bg-muted/20 flex flex-col transition-all duration-200 overflow-hidden", g.sidebarOpen ? "w-52" : "w-0")}>
        {g.sidebarOpen && (
          <BcaCountrySidebar
            countries={g.countries} totalCompanies={g.totalCompanies} totalContacts={cards.length}
            selectedCountry={g.selectedCountry} onSelectCountry={g.setSelectedCountry}
            onlyMatched={g.onlyMatched} onSetOnlyMatched={g.setOnlyMatched}
            onlyWithEmail={g.onlyWithEmail} onSetOnlyWithEmail={g.setOnlyWithEmail}
            hideHolding={g.hideHolding} holdingCount={g.holdingCount} onSetHideHolding={g.setHideHolding}
            sortMode={g.sortMode} onSetSortMode={g.setSortMode}
            viewMode={g.viewMode} onSetViewMode={g.setViewMode}
          />
        )}
      </div>

      <button onClick={() => g.setSidebarOpen(p => !p)} className="flex-shrink-0 w-5 flex items-center justify-center border-r border-border/30 hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground">
        {g.sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {/* Main content */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col px-4 pb-3 gap-3 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 pt-3 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input type="text" value={g.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca biglietto..." className="w-full h-8 pl-8 pr-3 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
          <button onClick={toggleAll} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all", allSelected ? "bg-primary/15 text-primary border-primary/30" : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50")}>
            <CheckSquare className="w-3.5 h-3.5" /> {allSelected ? "Deseleziona" : "Seleziona tutti"}
          </button>
          <span className="text-xs text-muted-foreground">
            {g.filtered.length} biglietti · {g.groups.length} aziende
            {selectedBca.size > 0 && <span className="ml-1 text-primary">· {selectedBca.size} sel.</span>}
          </span>
          {selectedBca.size > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <UnifiedBulkActionBar
                count={selectedBca.size} sourceType="business_card"
                onClear={() => setSelectedBca(new Set())}
                onCockpit={handleSendToCockpit}
                onDeepSearch={handleBcaDeepSearch}
                onWorkspace={() => {
                  const selected = g.filtered.filter(c => selectedBca.has(c.id) && c.email);
                  if (selected.length === 0) { toast.warning("Nessun contatto con email"); return; }
                  navigate("/email-composer", { state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) } });
                }}
                onLinkedIn={() => {
                  const selected = g.filtered.filter(c => selectedBca.has(c.id));
                  const first = selected.find(c => c.contact_name);
                  if (first) { window.open(`https://www.google.com/search?q=${encodeURIComponent(`${first.contact_name} ${first.company_name || ""} LinkedIn`)}`, "_blank"); }
                }}
                onCampaign={() => {
                  const selected = g.filtered.filter(c => selectedBca.has(c.id) && c.email);
                  if (selected.length === 0) { toast.warning("Nessun contatto con email"); return; }
                  navigate("/email-composer", { state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) } });
                }}
                withEmail={g.filtered.filter(c => selectedBca.has(c.id) && c.email).length}
                withPhone={g.filtered.filter(c => selectedBca.has(c.id) && (c.phone || c.mobile)).length}
              />
            </div>
          )}
          <Button size="sm" className="h-7 text-xs gap-1.5 ml-auto" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} /> {syncing ? "Sync..." : "Sincronizza"}
          </Button>
        </div>

        <DeepSearchCanvas open={deepSearch.canvasOpen} onClose={() => deepSearch.setCanvasOpen(false)} onStop={() => deepSearch.stop()} current={deepSearch.current} results={deepSearch.results} running={deepSearch.running} isDark={true} />

        {/* Quality Dashboard */}
        <BCAQualityDashboard cards={cards} />

        {/* Timeline toggle */}
        <div className="flex items-center gap-2">
          <Button variant={timelineMode ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => setTimelineMode(!timelineMode)}>
            <Clock className="w-3 h-3" /> Timeline Evento
          </Button>
        </div>

        {/* Card list or timeline */}
        <div className="flex-1 min-h-0 overflow-auto">
          {timelineMode ? (
            <BCAEventTimeline cards={g.filtered} />
          ) : g.groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <CreditCard className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground/60">Nessun biglietto da visita</p>
            </div>
          ) : (
            <div className="space-y-3">
              {g.groups.map(group => (
                <div key={group.key} className={cn("rounded-xl border overflow-hidden transition-all", group.isMatched ? "border-primary/30 bg-primary/[0.03]" : "border-border/60 bg-card/40")}>
                  {/* Group header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border", group.isMatched ? "border-primary/30 bg-primary/10" : "border-border/40 bg-muted/30")}>
                      {group.logoUrl ? <OptimizedImage src={group.logoUrl} alt="" className="w-7 h-7 rounded object-contain" /> : <Building2 className={cn("w-4 h-4", group.isMatched ? "text-primary/60" : "text-muted-foreground/40")} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {group.countryCode && <span className="text-lg leading-none flex-shrink-0">{countryCodeToFlag(group.countryCode)}</span>}
                        <span className="text-sm font-semibold text-foreground truncate">{group.companyName}</span>
                        {group.isMatched && <Badge variant="outline" className="text-[9px] bg-primary/15 text-primary border-primary/30 flex-shrink-0">WCA</Badge>}
                        {group.hasDeepSearch && <Brain className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                        {group.inHolding && <span title="In circuito di attesa"><Plane className="w-3.5 h-3.5 text-primary flex-shrink-0 animate-pulse" /></span>}
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

                  {/* Cards by viewMode */}
                  {g.viewMode === "compact" ? (
                    <div className="divide-y divide-border/20">
                      {group.cards.map(card => (
                        <BcaCompactCard key={card.id} card={card} isSelected={selectedBca.has(card.id)} onToggle={toggleBca} groupCompanyName={group.companyName} onSendEmail={handleSendEmail} onSendWhatsApp={handleSendWhatsApp} />
                      ))}
                    </div>
                  ) : g.viewMode === "expanded" ? (
                    <div className="space-y-2 p-3">
                      {group.cards.map(card => (
                        <BcaExpandedCard key={card.id} card={card} isSelected={selectedBca.has(card.id)} onToggle={toggleBca} groupCompanyName={group.companyName} onSendEmail={handleSendEmail} onSendWhatsApp={handleSendWhatsApp} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
                      {group.cards.map(card => (
                        <BcaGridCard key={card.id} card={card} isSelected={selectedBca.has(card.id)} onToggle={toggleBca} groupCompanyName={group.companyName} onSendEmail={handleSendEmail} onSendWhatsApp={handleSendWhatsApp} />
                      ))}
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
