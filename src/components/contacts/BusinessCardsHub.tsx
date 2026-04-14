import { useState, useCallback } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Handshake, Loader2, ImagePlus, LayoutGrid, LayoutList, Rows3,
} from "lucide-react";
import { UnifiedBulkActionBar } from "@/components/shared/UnifiedBulkActionBar";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { useBusinessCards, type BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isImageFile, isDataFile } from "@/lib/businessCardFileParser";

// Sub-components
import { CompactRow, CardGridItem, ExpandedCardItem } from "./bca/BCACardRenderers";
import { BusinessCardDetailPanel } from "./bca/BCADetailPanel";
import { useUploadAndParse, DropZone } from "./bca/BCAUpload";
import { googleLogoSearchUrl } from "./bca/bcaUtils";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";
import { deleteBusinessCards } from "@/data/businessCards";

type ViewMode = "compact" | "card" | "expanded";

export default function BusinessCardsHub() {
  const navigate = useAppNavigate();
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCard, setDetailCard] = useState<BusinessCardWithPartner | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [eventName, setEventName] = useState("");
  const [metAt, setMetAt] = useState("");
  const [location, setLocation] = useState("");

  const { handleSendEmail, handleSendWhatsApp, waAvailable: _waAvailable } = useDirectContactActions();
  const { processFiles, uploading, progress } = useUploadAndParse();
  const { data: cards = [], isLoading, refetch } = useBusinessCards({
    event_name: eventFilter || undefined,
    match_status: statusFilter || undefined,
  });

  const eventNames = [...new Set(cards.map((c) => c.event_name).filter(Boolean))] as string[];
  const pendingImages = pendingFiles.filter(isImageFile).length;
  const pendingData = pendingFiles.filter(isDataFile).length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const handleFiles = useCallback((files: File[]) => { setPendingFiles(files); setShowEventDialog(true); }, []);
  const handleConfirmUpload = useCallback(async () => {
    setShowEventDialog(false);
    const meta = { event_name: eventName || undefined, met_at: metAt || undefined, location: location || undefined };
    await processFiles(pendingFiles, meta);
    setPendingFiles([]);
  }, [pendingFiles, eventName, metAt, location, processFiles]);

  const handleGoogleLogo = useCallback((companyName: string | null) => {
    if (companyName) window.open(googleLogoSearchUrl(companyName), "_blank");
  }, []);

  // Bulk actions
  const handleBulkEmail = useCallback(() => {
    const selected = cards.filter(c => selectedIds.has(c.id) && c.email);
    if (selected.length === 0) { toast({ title: "Nessun contatto con email" }); return; }
    if (selected.length === 1) {
      handleSendEmail({ email: selected[0].email!, name: selected[0].contact_name || undefined, company: selected[0].company_name || undefined });
    } else {
      navigate("/email-composer", { state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) } });
    }
  }, [cards, selectedIds, handleSendEmail, navigate]);

  const handleBulkWhatsApp = useCallback(() => {
    const selected = cards.filter(c => selectedIds.has(c.id) && (c.phone || c.mobile));
    if (selected.length === 0) { toast({ title: "Nessun contatto con telefono" }); return; }
    const first = selected[0];
    handleSendWhatsApp({ phone: (first.mobile || first.phone)!, contactName: first.contact_name || undefined, companyName: first.company_name || undefined, sourceType: "contact", sourceId: first.id });
  }, [cards, selectedIds, handleSendWhatsApp]);

  const handleBulkCockpit = useCallback(async () => {
    const selected = cards.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const inserts = selected.map(c => ({ source_id: c.id, source_type: "business_card", user_id: user.id, partner_id: c.matched_partner_id || null }));
      await insertCockpitQueueItems(inserts);
      toast({ title: `✅ ${selected.length} aggiunti al Cockpit` });
      setSelectedIds(new Set());
    } catch (e: unknown) { toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  }, [cards, selectedIds]);

  const handleBulkWorkspace = useCallback(() => {
    const selected = cards.filter(c => selectedIds.has(c.id) && c.email);
    if (selected.length === 0) { toast({ title: "Nessun contatto con email" }); return; }
    navigate("/email-composer", { state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) } });
  }, [cards, selectedIds, navigate]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Eliminare ${ids.length} biglietti da visita?`)) return;
    await deleteBusinessCards(ids);
    toast({ title: `✅ ${ids.length} biglietti eliminati` });
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, refetch]);

  const showPanel = !!detailCard;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <UnifiedBulkActionBar
        count={selectedIds.size} sourceType="business_card"
        onClear={() => setSelectedIds(new Set())} onEmail={handleBulkEmail} onWhatsApp={handleBulkWhatsApp}
        onCockpit={handleBulkCockpit} onWorkspace={handleBulkWorkspace} onDelete={handleBulkDelete}
        onDeepSearch={() => {
          const partnerIds = new Set<string>();
          for (const id of selectedIds) { const card = cards.find(c => c.id === id); if (card?.matched_partner_id) partnerIds.add(card.matched_partner_id); }
          if (partnerIds.size === 0) { toast({ title: "Nessun biglietto associato a un partner" }); return; }
          invokeEdge("ai-utility", { body: { action: "deep_search", partnerIds: Array.from(partnerIds) }, context: "BusinessCardsHub.deep_search_partner" })
            .then(() => toast({ title: `✅ Deep Search avviata su ${partnerIds.size} partner` }))
            .catch(() => toast({ title: "Errore Deep Search", variant: "destructive" }));
        }}
        onGoogleLogo={() => {
          const selected = cards.filter(c => selectedIds.has(c.id));
          const first = selected.find(c => c.company_name);
          if (first?.company_name) window.open(googleLogoSearchUrl(first.company_name), "_blank");
        }}
        onLinkedIn={() => {
          const selected = cards.filter(c => selectedIds.has(c.id));
          const names = selected.map(c => ({ name: c.contact_name || "", company: c.company_name || "" })).filter(n => n.name);
          if (names.length === 0) { toast({ title: "Nessun contatto con nome" }); return; }
          const query = `${names[0].name} ${names[0].company} LinkedIn`;
          window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
        }}
        onCampaign={() => {
          const selected = cards.filter(c => selectedIds.has(c.id) && c.email);
          if (selected.length === 0) { toast({ title: "Nessun contatto con email" }); return; }
          navigate("/email-composer", { state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) } });
        }}
        withEmail={cards.filter(c => selectedIds.has(c.id) && c.email).length}
        withPhone={cards.filter(c => selectedIds.has(c.id) && (c.phone || c.mobile)).length}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className={cn("flex-1 min-w-0 overflow-y-auto p-3 space-y-3", showPanel && "border-r border-border/50")}>
          <DropZone onFiles={handleFiles} uploading={uploading} progress={progress} />

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-7 w-[120px] text-[11px]"><SelectValue placeholder="Tutti" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="matched">Matchati</SelectItem>
                <SelectItem value="unmatched">No match</SelectItem>
                <SelectItem value="pending">Attesa</SelectItem>
              </SelectContent>
            </Select>

            {eventNames.length > 0 && (
              <Select value={eventFilter} onValueChange={(v) => setEventFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-7 w-[140px] text-[11px]"><SelectValue placeholder="Tutti eventi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {eventNames.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-1.5">
              <Checkbox
                checked={cards.length > 0 && selectedIds.size === cards.length}
                onCheckedChange={(checked) => { if (checked) setSelectedIds(new Set(cards.map(c => c.id))); else setSelectedIds(new Set()); }}
                aria-label="Seleziona tutti" className="shrink-0"
              />
              <span className="text-[10px] text-muted-foreground">Tutti</span>
            </div>
            <Badge variant="outline" className="text-[10px] h-7 px-2 border-primary/15">{cards.length} biglietti</Badge>

            <div className="ml-auto flex items-center gap-0.5 bg-muted/40 rounded-md p-0.5">
              {([
                { mode: "compact" as ViewMode, icon: LayoutList, label: "Lista" },
                { mode: "card" as ViewMode, icon: LayoutGrid, label: "Card" },
                { mode: "expanded" as ViewMode, icon: Rows3, label: "Espanso" },
              ]).map(({ mode, icon: Icon, label }) => (
                <TooltipProvider key={mode}>
                  <Tooltip><TooltipTrigger asChild>
                    <button className={cn("p-1.5 rounded transition-colors", viewMode === mode ? "bg-background shadow-sm" : "hover:bg-muted/60")} onClick={() => setViewMode(mode)}>
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">{label}</TooltipContent></Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><ImagePlus className="w-8 h-8 text-primary/50" /></div>
              <p className="text-sm text-muted-foreground">Nessun biglietto da visita</p>
            </div>
          ) : viewMode === "compact" ? (
            <div className="space-y-0.5">
              {cards.map((card) => <CompactRow key={card.id} card={card} isSelected={selectedIds.has(card.id)} onSelect={() => toggleSelect(card.id)} onShowDetail={() => setDetailCard(card)} onGoogleLogo={() => handleGoogleLogo(card.company_name)} />)}
            </div>
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {cards.map((card) => <CardGridItem key={card.id} card={card} isSelected={selectedIds.has(card.id)} onSelect={() => toggleSelect(card.id)} onShowDetail={() => setDetailCard(card)} onGoogleLogo={() => handleGoogleLogo(card.company_name)} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {cards.map((card) => <ExpandedCardItem key={card.id} card={card} isSelected={selectedIds.has(card.id)} onSelect={() => toggleSelect(card.id)} onShowDetail={() => setDetailCard(card)} onGoogleLogo={() => handleGoogleLogo(card.company_name)} />)}
            </div>
          )}
        </div>

        {showPanel && detailCard && (
          <div className="w-[320px] shrink-0 bg-card/50 backdrop-blur-sm flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 shrink-0">
              <span className="text-xs font-medium text-muted-foreground">Dettaglio</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setDetailCard(null)}>✕</Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <BusinessCardDetailPanel card={detailCard} onClose={() => setDetailCard(null)} />
            </div>
          </div>
        )}
      </div>

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-sm bg-card border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Handshake className="w-4 h-4 text-primary" /> Dettagli incontro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {pendingImages > 0 && <Badge variant="outline" className="text-[10px] border-primary/20">📸 {pendingImages} foto</Badge>}
              {pendingData > 0 && <Badge variant="outline" className="text-[10px] border-emerald-500/20">📄 {pendingData} file</Badge>}
            </div>
            <div><label className="text-xs text-muted-foreground">Evento / Fiera</label><Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="es. Cosmoprof 2026" className="h-8 text-xs mt-1" /></div>
            <div><label className="text-xs text-muted-foreground">Data incontro</label><Input type="date" value={metAt} onChange={(e) => setMetAt(e.target.value)} className="h-8 text-xs mt-1" /></div>
            <div><label className="text-xs text-muted-foreground">Luogo</label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="es. Bologna" className="h-8 text-xs mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEventDialog(false)}>Annulla</Button>
            <Button size="sm" onClick={handleConfirmUpload}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
