/**
 * BCAUnifiedHub — Pagina CRM › Biglietti unificata.
 *
 * Combina:
 *  - Layout della Network › BCA (`BusinessCardsView`): sidebar paesi, gruppi
 *    per azienda, 3 modalità di vista, Quality Dashboard, Timeline Evento,
 *    sincronizzazione WCA.
 *  - Detail panel CRM (potenziato): al click su una card si apre a destra il
 *    `BCAUnifiedDetailPanel` con 4 grandi azioni intelligenti che fungono
 *    anche da drop target indipendenti.
 *
 * Drag&Drop:
 *  - Solo nella view "card" (media): ogni card espone un drag handle a 6
 *    puntini. Trascinandola sulle azioni intelligenti del pannello, l'azione
 *    sotto il puntatore si illumina e al drop esegue su quel contatto.
 */
import { useMemo, useState, useEffect, useRef } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import {
  Building2, CreditCard, Brain, Search, RefreshCw, CheckSquare, Plane,
  Clock, X, LayoutList, LayoutGrid, Rows3,
} from "lucide-react";
import { UnifiedBulkActionBar } from "@/components/shared/UnifiedBulkActionBar";
import { BCAQualityDashboard } from "@/components/operations/bca/BCAQualityDashboard";
import { BCAEventTimeline } from "@/components/operations/bca/BCAEventTimeline";
import { cn } from "@/lib/utils";
import { useBusinessCards, type BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { useSendToCockpit } from "@/hooks/useCockpitContacts";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { DeepSearchCanvas } from "@/components/operations/DeepSearchCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { createLogger } from "@/lib/log";
import { useBcaFiltersStrict } from "./BcaFiltersContext";
import { BcaCompactCard, BcaGridCard, BcaExpandedCard } from "@/components/operations/bca/BcaCardRenderers";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { queryKeys } from "@/lib/queryKeys";
import { BCAUnifiedDetailPanel } from "./BCAUnifiedDetailPanel";
import { BCADragDropOverlay } from "./BCADragDropOverlay";
import { BCABulkActionsPanel } from "./BCABulkActionsPanel";
import { deleteBusinessCards } from "@/data/businessCards";

const log = createLogger("BCAUnifiedHub");

export default function BCAUnifiedHub() {
  const { data: cards = [], isLoading } = useBusinessCards();
  const qc = useQueryClient();
  const sendToCockpit = useSendToCockpit();
  const deepSearch = useDeepSearch();
  const navigate = useAppNavigate();
  const { handleSendEmail, handleSendWhatsApp } = useDirectContactActions();
  const [selectedBca, setSelectedBca] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [timelineMode, setTimelineMode] = useState(false);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);

  // Stato filtri condiviso con la linguetta globale (`ContextFiltersRail`).
  // Il `BcaFiltersGate` in `AuthenticatedLayout` garantisce il provider sulle
  // route biglietti, quindi qui usiamo la versione strict ed evitiamo di
  // ricalcolare due volte le stesse memo pesanti (groups/filtered/...).
  const g = useBcaFiltersStrict();

  const cardsById = useMemo(() => {
    const m = new Map<string, BusinessCardWithPartner>();
    for (const c of cards) m.set(c.id, c);
    return m;
  }, [cards]);
  const detailCard = detailCardId ? cardsById.get(detailCardId) ?? null : null;
  const resolveCard = (id: string) => cardsById.get(id);

  // Auto-selezione del primo biglietto della lista filtrata: stesso pattern
  // di `EntityListWithDetail` (WCA Partner / CRM). Si attiva solo se non è
  // già aperto un dettaglio e l'utente non è in selezione multipla.
  const autoFocusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (detailCardId) { autoFocusedRef.current = null; return; }
    if (selectedBca.size > 0) return;
    const first = g.filtered[0];
    if (!first) return;
    if (autoFocusedRef.current === first.id) return;
    autoFocusedRef.current = first.id;
    setDetailCardId(first.id);
  }, [isLoading, detailCardId, selectedBca.size, g.filtered]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await invokeEdge<Record<string, number>>("sync-business-cards", { context: "BCAUnifiedHub.sync_business_cards" });
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
      partnerId: cardsById.get(id)?.matched_partner_id || undefined,
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
      const card = cardsById.get(id);
      if (card?.matched_partner_id) partnerIds.add(card.matched_partner_id);
    }
    if (partnerIds.size === 0) { toast.warning("Nessun biglietto associato a un partner."); return; }
    deepSearch.start(Array.from(partnerIds), true);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedBca);
    if (!ids.length) return;
    if (!confirm(`Eliminare ${ids.length} biglietti da visita?`)) return;
    try {
      await deleteBusinessCards(ids);
      toast.success(`${ids.length} biglietti eliminati`);
      setSelectedBca(new Set());
      qc.invalidateQueries({ queryKey: queryKeys.businessCards.all });
    } catch (e: unknown) {
      toast.error("Errore eliminazione: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const bulkMode = selectedBca.size >= 2;
  const showPanel = bulkMode || !!detailCard;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden px-4 pb-3">
        {/* Toolbar unica — search + vista + counter + bulk + timeline + sync */}
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input type="text" value={g.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca biglietto..." className="w-full h-7 pl-8 pr-3 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
          <TooltipProvider delayDuration={200}>
            <div className="inline-flex items-center gap-0.5 rounded-md border border-border/40 bg-muted/30 p-0.5">
              {([
                ["compact", LayoutList, "Compatta"],
                ["card", LayoutGrid, "Media"],
                ["expanded", Rows3, "Espansa"],
              ] as const).map(([mode, Icon, label]) => (
                <Tooltip key={mode}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => g.setViewMode(mode)}
                      className={cn(
                        "p-1 rounded transition-all",
                        g.viewMode === mode
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      )}
                      aria-label={label}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px]">{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
          <button onClick={toggleAll} className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all", allSelected ? "bg-primary/15 text-primary border-primary/30" : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50")}>
            <CheckSquare className="w-3 h-3" /> {allSelected ? "Deseleziona" : "Tutti"}
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
                onDelete={handleBulkDelete}
                onWorkspace={() => {
                  const selected = g.filtered.filter(c => selectedBca.has(c.id) && c.email);
                  if (selected.length === 0) { toast.warning("Nessun contatto con email"); return; }
                  navigate("/v2/email-composer", { state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) } });
                }}
                onLinkedIn={() => {
                  const selected = g.filtered.filter(c => selectedBca.has(c.id));
                  const first = selected.find(c => c.contact_name);
                  if (first) { window.open(`https://www.google.com/search?q=${encodeURIComponent(`${first.contact_name} ${first.company_name || ""} LinkedIn`)}`, "_blank"); }
                }}
                onCampaign={() => {
                  const selected = g.filtered.filter(c => selectedBca.has(c.id) && c.email);
                  if (selected.length === 0) { toast.warning("Nessun contatto con email"); return; }
                  navigate("/v2/email-composer", { state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) } });
                }}
                withEmail={g.filtered.filter(c => selectedBca.has(c.id) && c.email).length}
                withPhone={g.filtered.filter(c => selectedBca.has(c.id) && (c.phone || c.mobile)).length}
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant={timelineMode ? "default" : "outline"} size="sm" className="h-7 text-[11px] gap-1" onClick={() => setTimelineMode(!timelineMode)} title="Timeline evento">
              <Clock className="w-3 h-3" /> Timeline
            </Button>
            <Button size="sm" className="h-7 text-[11px] gap-1" variant="outline" onClick={handleSync} disabled={syncing} title="Sincronizza biglietti">
              <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} /> {syncing ? "Sync..." : "Sincronizza"}
            </Button>
          </div>
        </div>

        <DeepSearchCanvas open={deepSearch.canvasOpen} onClose={() => deepSearch.setCanvasOpen(false)} onStop={() => deepSearch.stop()} current={deepSearch.current} results={deepSearch.results} running={deepSearch.running} isDark={true} />

        <BCAQualityDashboard cards={cards} />

        {/* Two-column body: list + detail panel */}
        <div className="flex min-h-0 flex-1 overflow-hidden gap-3">
          <div className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain", showPanel && "border-r border-border/40 pr-3")}>
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
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border", group.isMatched ? "border-primary/30 bg-primary/10" : "border-border/40 bg-muted/30")}>
                        {group.logoUrl ? <OptimizedImage src={group.logoUrl} alt="" className="w-7 h-7 rounded object-contain" /> : <Building2 className={cn("w-4 h-4", group.isMatched ? "text-primary/60" : "text-muted-foreground/40")} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {group.countryCode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const cc = group.countryCode!;
                                g.setSelectedCountry(g.selectedCountry === cc ? null : cc);
                              }}
                              className={cn(
                                "text-lg leading-none flex-shrink-0 rounded hover:ring-1 hover:ring-primary/40 transition-all",
                                g.selectedCountry === group.countryCode && "ring-1 ring-primary/60"
                              )}
                              aria-label={`Filtra per paese ${group.countryCode}`}
                              title={`Filtra per paese ${group.countryCode}`}
                            >
                              {countryCodeToFlag(group.countryCode)}
                            </button>
                          )}
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

                    {g.viewMode === "compact" ? (
                      <div className="divide-y divide-border/20">
                        {group.cards.map(card => (
                          <BcaCompactCard
                            key={card.id}
                            card={card}
                            isSelected={selectedBca.has(card.id)}
                            isOpened={detailCardId === card.id}
                            onToggle={toggleBca}
                            onOpenDetail={(id) => setDetailCardId(id)}
                            enableDrag
                            groupCompanyName={group.companyName}
                            onSendEmail={handleSendEmail}
                            onSendWhatsApp={handleSendWhatsApp}
                          />
                        ))}
                      </div>
                    ) : g.viewMode === "expanded" ? (
                      <div className="space-y-2 p-3">
                        {group.cards.map(card => (
                          <BcaExpandedCard
                            key={card.id}
                            card={card}
                            isSelected={selectedBca.has(card.id)}
                            isOpened={detailCardId === card.id}
                            onToggle={toggleBca}
                            onOpenDetail={(id) => setDetailCardId(id)}
                            enableDrag
                            groupCompanyName={group.companyName}
                            onSendEmail={handleSendEmail}
                            onSendWhatsApp={handleSendWhatsApp}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
                        {group.cards.map(card => (
                          <BcaGridCard
                            key={card.id}
                            card={card}
                            isSelected={selectedBca.has(card.id)}
                            isOpened={detailCardId === card.id}
                            onToggle={toggleBca}
                            onOpenDetail={(id) => setDetailCardId(id)}
                            enableDrag
                            groupCompanyName={group.companyName}
                            onSendEmail={handleSendEmail}
                            onSendWhatsApp={handleSendWhatsApp}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {showPanel && detailCard && (
            <div className="w-[360px] shrink-0 bg-card/40 backdrop-blur-sm flex flex-col h-full overflow-hidden rounded-xl border border-border/40">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
                <span className="text-xs font-medium text-muted-foreground">
                  {bulkMode ? `${selectedBca.size} biglietti selezionati` : "Dettaglio biglietto"}
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setDetailCardId(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {bulkMode ? (
                  <BCABulkActionsPanel
                    cards={Array.from(selectedBca).map(id => cardsById.get(id)).filter((c): c is BusinessCardWithPartner => !!c)}
                    onClear={() => setSelectedBca(new Set())}
                    onRemove={(id: string) => setSelectedBca(prev => { const n = new Set(prev); n.delete(id); return n; })}
                    onCockpit={handleSendToCockpit}
                    onDeepSearch={handleBcaDeepSearch}
                    onDelete={handleBulkDelete}
                  />
                ) : detailCard ? (
                  <BCAUnifiedDetailPanel card={detailCard} onClose={() => setDetailCardId(null)} />
                ) : null}
              </div>
            </div>
          )}
          {/* When only bulk is active (no single detail) we still need to render the panel */}
          {bulkMode && !detailCard && null}
        </div>
      </div>
      {/* Overlay drag&drop globale (visibile solo durante il drag di un biglietto) */}
      <BCADragDropOverlay resolveCard={resolveCard} />
    </div>
  );
}