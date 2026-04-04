import { useState, useMemo, useCallback } from "react";
import { Building2, CreditCard, Brain, Send, Search, RefreshCw, CheckSquare, LayoutList, LayoutGrid, Rows3, Mail, Phone } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useBusinessCards, type BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { useSendToCockpit } from "@/hooks/useCockpitContacts";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { DeepSearchCanvas } from "@/components/operations/DeepSearchCanvas";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ViewMode = "compact" | "card" | "expanded";

interface BcaGroup {
  key: string;
  companyName: string;
  logoUrl: string | null;
  hasDeepSearch: boolean;
  isMatched: boolean;
  partnerId: string | null;
  countryCode: string | null;
  cards: BusinessCardWithPartner[];
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
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  const codePoints = upper.split("").map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function BusinessCardsView() {
  const { data: cards = [], isLoading } = useBusinessCards();
  const qc = useQueryClient();
  const sendToCockpit = useSendToCockpit();
  const deepSearch = useDeepSearch();
  const [selectedBca, setSelectedBca] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-business-cards");
      if (error) throw error;
      toast.success(`Sincronizzazione completata: ${data?.upserted ?? 0} biglietti aggiornati`);
      qc.invalidateQueries({ queryKey: ["business-cards"] });
    } catch (e: any) {
      toast.error("Errore sincronizzazione: " + (e.message || "sconosciuto"));
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return cards;
    const q = search.toLowerCase();
    return cards.filter(c =>
      (c.company_name || "").toLowerCase().includes(q) ||
      (c.contact_name || "").toLowerCase().includes(q) ||
      (c.event_name || "").toLowerCase().includes(q)
    );
  }, [cards, search]);

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
          partnerId: card.matched_partner_id || null,
          countryCode: partner?.country_code || guessCountryFromLocation(card.location, card.phone || card.mobile),
          cards: [],
        });
      }
      map.get(key)!.cards.push(card);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.isMatched !== b.isMatched) return a.isMatched ? -1 : 1;
      return b.cards.length - a.cards.length;
    });
  }, [filtered]);

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
    } catch { toast.error("Errore nell'invio al Cockpit"); }
  };

  const handleBcaDeepSearch = () => {
    const partnerIds = new Set<string>();
    for (const id of selectedBca) {
      const card = cards.find(c => c.id === id);
      if (card?.matched_partner_id) partnerIds.add(card.matched_partner_id);
    }
    if (partnerIds.size === 0) { toast.warning("Nessun biglietto selezionato è associato a un partner."); return; }
    deepSearch.start(Array.from(partnerIds), true);
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col px-4 pb-3 gap-3 overflow-hidden">
      <div className="flex items-center gap-3 pt-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca biglietto da visita..." className="w-full h-8 pl-8 pr-3 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
        </div>
        <button onClick={toggleAll} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all", allSelected ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50")}>
          <CheckSquare className="w-3.5 h-3.5" /> {allSelected ? "Deseleziona" : "Seleziona tutti"}
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} biglietti · {groups.length} aziende{selectedBca.size > 0 && <span className="ml-1 text-amber-500">· {selectedBca.size} sel.</span>}</span>
        {selectedBca.size > 0 && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 hover:bg-amber-500/25" variant="outline" onClick={handleSendToCockpit}><Send className="w-3 h-3" /> Cockpit ({selectedBca.size})</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-violet-500/15 text-violet-500 border border-violet-500/30 hover:bg-violet-500/25" variant="outline" onClick={handleBcaDeepSearch}><Brain className="w-3 h-3" /> Deep Search</Button>
          </div>
        )}
        <Button size="sm" className="h-7 text-xs gap-1.5 ml-auto" variant="outline" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} /> {syncing ? "Sync..." : "Sincronizza"}
        </Button>
      </div>

      <DeepSearchCanvas open={deepSearch.canvasOpen} onClose={() => deepSearch.setCanvasOpen(false)} onStop={() => deepSearch.stop()} current={deepSearch.current} results={deepSearch.results} running={deepSearch.running} isDark={true} />

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
                      {group.countryCode && <span className="text-4xl leading-none flex-shrink-0">{countryCodeToFlag(group.countryCode)}</span>}
                      <span className="text-sm font-semibold text-foreground truncate">{group.companyName}</span>
                      {group.isMatched && <Badge variant="outline" className="text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/30 flex-shrink-0">WCA</Badge>}
                      {group.hasDeepSearch && <Brain className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" />}
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
                  {group.cards.map(card => {
                    const isSelected = selectedBca.has(card.id);
                    return (
                      <div key={card.id} className={cn("relative rounded-lg border p-3 cursor-pointer transition-all duration-150 hover:shadow-sm", isSelected ? "border-amber-500/40 bg-amber-500/[0.06] shadow-[0_0_8px_rgba(245,158,11,0.1)]" : "border-border/40 bg-card/30 hover:border-border/60")} onClick={() => toggleBca(card.id)}>
                        <div className="absolute top-2 right-2"><Checkbox checked={isSelected} onCheckedChange={() => toggleBca(card.id)} className="w-3.5 h-3.5" /></div>
                        <div className="space-y-1.5 pr-6">
                          <div className="text-xs font-semibold text-foreground truncate">{card.contact_name || "—"}</div>
                          {card.position && <div className="text-[10px] text-muted-foreground truncate">{card.position}</div>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {card.email && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono truncate max-w-[150px]">{card.email}</span>}
                            {(card.phone || card.mobile) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/10 text-success font-mono">{card.mobile || card.phone}</span>}
                          </div>
                          {card.event_name && <div className="text-[9px] text-muted-foreground/60 truncate mt-1">📍 {card.event_name}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
