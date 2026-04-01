import { useState, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sun, Moon, Bot, Globe, Users, FolderOpen, Eye, CreditCard, Send, Search, Brain, Phone, Mail, Calendar, Building2, CheckSquare, RefreshCw,
} from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { DeepSearchCanvas } from "@/components/operations/DeepSearchCanvas";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { AiAssistantDialog } from "@/components/operations/AiAssistantDialog";
import { ThemeCtx, t } from "@/components/download/theme";
import { CountryGrid, type FilterKey } from "@/components/download/CountryGrid";
import { PartnerListPanel } from "@/components/operations/PartnerListPanel";
import { PartnerDetailCompact } from "@/components/partners/PartnerDetailCompact";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCountryStats } from "@/hooks/useCountryStats";
import { usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useBusinessCards, useBusinessCardPartnerMatches, type BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { useSendToCockpit } from "@/hooks/useCockpitContacts";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Read directory totals — shares cache key with CountryGrid */
function useDirectoryTotal() {
  return useQuery({
    queryKey: ["cache-data-by-country"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_directory_counts");
      const result: Record<string, { count: number; verified: boolean }> = {};
      (data || []).forEach((r: any) => {
        result[r.country_code] = { count: Number(r.member_count) || 0, verified: r.is_verified === true };
      });
      return result;
    },
    staleTime: 60_000,
  });
}

/** Portal: renders Network controls into the global header slot */
function HeaderBarPortal({ networkView, setNetworkView, globalStats, deepSearch }: {
  networkView: "partners" | "bca";
  setNetworkView: (v: "partners" | "bca") => void;
  globalStats: any;
  deepSearch: any;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById("campaign-header-controls");
    setContainer(el);
  }, []);

  if (!container) return null;

  return createPortal(
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <Globe className="w-4 h-4 text-primary/70 animate-spin-slow flex-shrink-0" />
      <span className="text-xs font-semibold text-foreground hidden sm:inline">Network</span>

      <div className="flex items-center rounded-lg border border-border/60 bg-card/60 p-0.5">
        <button
          onClick={() => setNetworkView("partners")}
          className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all",
            networkView === "partners" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-3 h-3" /> Partner
        </button>
        <button
          onClick={() => setNetworkView("bca")}
          className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all",
            networkView === "bca" ? "bg-accent/50 text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CreditCard className="w-3 h-3" /> BCA
        </button>
      </div>

      {globalStats && (
        <span className="hidden md:flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Users className="w-3 h-3" />
          <span className="font-mono">{globalStats.totalPartners}</span> partner
        </span>
      )}

      {(deepSearch.running || deepSearch.results.length > 0) && !deepSearch.canvasOpen && (
        <button onClick={() => deepSearch.setCanvasOpen(true)} className="p-1 rounded-md bg-accent/20 hover:bg-accent/30 text-accent-foreground" title="Deep Search">
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}
    </div>,
    container
  );
}

export default function Operations() {
  const [networkView, setNetworkView] = useState<"partners" | "bca">("partners");
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem("dl_theme");
    return s !== null ? s === "dark" : true;
  });
  const toggleTheme = () => setIsDark(p => { const n = !p; localStorage.setItem("dl_theme", n ? "dark" : "light"); return n; });
  const isMobile = useIsMobile();

  const [selectedCountries, setSelectedCountries] = useState<{ code: string; name: string }[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [directoryOnly, setDirectoryOnly] = useState(false);
  const { filters } = useGlobalFilters();
  const filterMode = (filters.quality === "all" ? "all" : filters.quality) as FilterKey;
  const [aiOpen, setAiOpen] = useState(false);
  const deepSearch = useDeepSearch();
  const [aliasGenerating, setAliasGenerating] = useState(false);
  const queryClient = useQueryClient();
  const { data: countryStatsData } = useCountryStats();
  const { data: dirData } = useDirectoryTotal();
  const dirTotals = dirData ? {
    scannedCountries: Object.keys(dirData).length,
    totalDirectory: Object.values(dirData).reduce((sum, v) => sum + v.count, 0),
  } : null;
  const globalStats = countryStatsData ? {
    totalPartners: countryStatsData.global.total,
    withEmail: countryStatsData.global.withEmail,
    withPhone: countryStatsData.global.withPhone,
    withProfile: countryStatsData.global.withProfile,
    withoutProfile: countryStatsData.global.withoutProfile,
    scannedCountries: dirTotals?.scannedCountries || 0,
    totalDirectory: dirTotals?.totalDirectory || 0,
  } : null;

  const toggleFavorite = useToggleFavorite();

  const activeCountryCodes = useMemo(() => selectedCountries.map(c => c.code), [selectedCountries]);
  const activeCountryNames = useMemo(() => selectedCountries.map(c => c.name), [selectedCountries]);
  const hasSelection = selectedCountries.length > 0;

  const { data: selectedPartner } = usePartner(selectedPartnerId || "");

  const handleCountryClick = useCallback((code: string, name: string) => {
    setSelectedCountries(prev => {
      const exists = prev.some(c => c.code === code);
      const next = exists ? prev.filter(c => c.code !== code) : [...prev, { code, name }];
      if (next.length === 0) setSelectedPartnerId(null);
      return next;
    });
  }, []);

  const handleRemoveCountry = useCallback((code: string) => {
    setSelectedCountries(prev => {
      const next = prev.filter(c => c.code !== code);
      if (next.length === 0) setSelectedPartnerId(null);
      return next;
    });
  }, []);

  const handleDeepSearch = useCallback((partnerIds: string[]) => {
    deepSearch.start(partnerIds);
  }, [deepSearch]);

  const handleStopDeepSearch = useCallback(() => {
    deepSearch.stop();
  }, [deepSearch]);

  const handleGenerateAliases = useCallback(async (codes: string[], type: "company" | "contact") => {
    if (aliasGenerating) return;
    setAliasGenerating(true);
    const toastId = toast.loading("Generazione alias in corso...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-aliases", { body: { countryCodes: codes } });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Alias generati: ${data.processed ?? 0} aziende, ${data.contacts ?? 0} contatti (su ${data.total ?? 0} elaborati)`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ["partners"] });
        queryClient.invalidateQueries({ queryKey: ["country-stats"] });
      } else {
        toast.error(data?.error || "Errore generazione alias", { id: toastId });
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore", { id: toastId });
    } finally {
      setAliasGenerating(false);
    }
  }, [aliasGenerating, queryClient]);

  // Listen for sync-wca-trigger from global header button
  const handleSyncWca = useCallback(async () => {
    if (selectedCountries.length === 0) {
      toast.warning("Seleziona almeno un paese per sincronizzare");
      return;
    }
    const toastId = toast.loading(`Sincronizzazione WCA per ${selectedCountries.map(c => c.name).join(", ")}...`);
    try {
      for (const country of selectedCountries) {
        const { data, error } = await supabase.functions.invoke("sync-wca-partners", {
          body: { countryCode: country.code },
        });
        if (error) throw error;
      }
      toast.success("Sincronizzazione completata!", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["country-stats"] });
    } catch (e: any) {
      toast.error(e?.message || "Errore sincronizzazione", { id: toastId });
    }
  }, [selectedCountries, queryClient]);

  useEffect(() => {
    window.addEventListener("sync-wca-trigger", handleSyncWca);
    return () => window.removeEventListener("sync-wca-trigger", handleSyncWca);
  }, [handleSyncWca]);

  const hasDetailOpen = !isMobile && hasSelection;

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className="h-full min-h-0 relative flex flex-col overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.06),transparent)]" />

        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          {/* Portal into global header */}
          <HeaderBarPortal
            networkView={networkView}
            setNetworkView={setNetworkView}
            globalStats={globalStats}
            deepSearch={deepSearch}
          />

          {/* ═══ MAIN ═══ */}
          {networkView === "bca" ? (
            <BusinessCardsView />
          ) : (
          <div className={cn(
            "flex-1 min-h-0 px-4 pb-3 gap-3 overflow-hidden",
            isMobile ? "flex flex-col" : "flex"
          )}>
            {/* COL 1: Country Grid */}
            <div className={cn(
              "flex-shrink-0 min-h-0 overflow-hidden flex flex-col gap-2 transition-all duration-200",
              isMobile
                ? (hasSelection ? "max-h-[35vh]" : "")
                : (hasDetailOpen ? "w-[220px]" : "w-[280px]")
            )}>
              <CountryGrid
                selected={selectedCountries}
                onToggle={handleCountryClick}
                onRemove={handleRemoveCountry}
                filterMode={filterMode}
                directoryOnly={directoryOnly}
                onDirectoryOnlyChange={setDirectoryOnly}
                compact={hasSelection || isMobile}
              />
            </div>

            {/* COL 2: Partner List */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
            {hasSelection ? (
              <>
                <div className={cn(
                  "flex-1 min-h-0 rounded-xl border overflow-hidden relative",
                  "bg-card/50 backdrop-blur-sm border-border"
                )}>
                  <PartnerListPanel
                    countryCodes={activeCountryCodes}
                    countryNames={activeCountryNames}
                    isDark={isDark}
                    onDeepSearch={handleDeepSearch}
                    onGenerateAliases={handleGenerateAliases}
                    deepSearchRunning={deepSearch.running}
                    aliasGenerating={aliasGenerating}
                    directoryOnly={directoryOnly}
                    onDirectoryOnlyChange={setDirectoryOnly}
                    onSelectPartner={setSelectedPartnerId}
                    selectedPartnerId={selectedPartnerId}
                  />

                  {/* Deep Search Canvas overlay */}
                  <DeepSearchCanvas
                    open={deepSearch.canvasOpen}
                    onClose={() => deepSearch.setCanvasOpen(false)}
                    onStop={handleStopDeepSearch}
                    current={deepSearch.current}
                    results={deepSearch.results}
                    running={deepSearch.running}
                    isDark={isDark}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm">
                <Globe className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/60 font-medium">Seleziona un paese per vedere i partner</p>
                <p className="text-xs text-muted-foreground/40 mt-1">Clicca su uno o più paesi dall'elenco a sinistra</p>
              </div>
            )}
            </div>

            {/* COL 3: Partner Detail */}
            {hasDetailOpen && (
              <div className="w-[380px] flex-shrink-0 min-h-0 flex flex-col rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden animate-in slide-in-from-right-8 duration-200">
                {selectedPartnerId && selectedPartner ? (
                  <>
                    <div className="flex items-center px-3 py-1.5 flex-shrink-0 border-b border-border">
                      <span className="text-xs font-medium text-muted-foreground px-2 py-1">Dettaglio Partner</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto">
                      <PartnerDetailCompact
                        partner={selectedPartner}
                        onBack={() => setSelectedPartnerId(null)}
                        onToggleFavorite={() => toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })}
                        isDark={isDark}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40">
                    <Users className="w-8 h-8 mb-2" />
                    <p className="text-xs font-medium">Caricamento...</p>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
      <AiAssistantDialog open={aiOpen} onClose={() => setAiOpen(false)} context={{ selectedCountries, filterMode }} />
    </ThemeCtx.Provider>
  );
}

/* ── Stat Pill — tri-state color by value ── */
function StatPill({ icon: Icon, value, label, isDark, onClick, active, variant = "info" }: {
  icon: any; value: number; label: string; isDark: boolean;
  onClick?: () => void; active?: boolean;
  variant?: "info" | "warn" | "ok";
}) {
  const isComplete = variant === "ok" || (variant === "warn" && value === 0);
  const pillClass = isComplete || value === 0
    ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
    : value <= 10
      ? "bg-amber-500/15 border-amber-500/25 text-amber-300"
      : "bg-red-500/15 border-red-500/25 text-red-300";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold tabular-nums transition-all flex-shrink-0",
            pillClass,
            active && "ring-1 ring-current shadow-[0_0_8px_currentColor]"
          )}
        >
          <Icon className="w-3 h-3" />
          {value.toLocaleString()}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ── Business Cards View — Grouped by Company ── */
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

/** Derive country code from location string or phone prefix */
function guessCountryFromLocation(location: string | null, phone: string | null): string | null {
  if (!location && !phone) return null;
  // Try location first
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
  // Try phone prefix
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

function BusinessCardsView() {
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

  // Group by matched_partner_id or normalized company_name
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
    // Sort: matched first, then by card count desc
    return Array.from(map.values()).sort((a, b) => {
      if (a.isMatched !== b.isMatched) return a.isMatched ? -1 : 1;
      return b.cards.length - a.cards.length;
    });
  }, [filtered]);

  const allFilteredIds = useMemo(() => filtered.map(c => c.id), [filtered]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedBca.has(id));

  const toggleBca = (id: string) => {
    setSelectedBca(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedBca(new Set());
    } else {
      setSelectedBca(new Set(allFilteredIds));
    }
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
    } catch {
      toast.error("Errore nell'invio al Cockpit");
    }
  };

  const handleBcaDeepSearch = () => {
    // Collect unique partner IDs from selected BCA
    const partnerIds = new Set<string>();
    for (const id of selectedBca) {
      const card = cards.find(c => c.id === id);
      if (card?.matched_partner_id) partnerIds.add(card.matched_partner_id);
    }
    if (partnerIds.size === 0) {
      toast.warning("Nessun biglietto selezionato è associato a un partner. Esegui prima il match.");
      return;
    }
    deepSearch.start(Array.from(partnerIds), true);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col px-4 pb-3 gap-3 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 pt-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca biglietto da visita..."
            className="w-full h-8 pl-8 pr-3 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />
        </div>

        <button
          onClick={toggleAll}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all",
            allSelected
              ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
              : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
          )}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          {allSelected ? "Deseleziona" : "Seleziona tutti"}
        </button>

        <span className="text-xs text-muted-foreground">
          {filtered.length} biglietti · {groups.length} aziende
          {selectedBca.size > 0 && <span className="ml-1 text-amber-500">· {selectedBca.size} sel.</span>}
        </span>

        {selectedBca.size > 0 && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 hover:bg-amber-500/25" variant="outline" onClick={handleSendToCockpit}>
              <Send className="w-3 h-3" /> Cockpit ({selectedBca.size})
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-violet-500/15 text-violet-500 border border-violet-500/30 hover:bg-violet-500/25" variant="outline" onClick={handleBcaDeepSearch}>
              <Brain className="w-3 h-3" /> Deep Search
            </Button>
          </div>
        )}

        <Button size="sm" className="h-7 text-xs gap-1.5 ml-auto" variant="outline" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} /> {syncing ? "Sync..." : "Sincronizza"}
        </Button>
      </div>

      {/* Deep Search Canvas */}
      <DeepSearchCanvas
        open={deepSearch.canvasOpen}
        onClose={() => deepSearch.setCanvasOpen(false)}
        onStop={() => deepSearch.stop()}
        current={deepSearch.current}
        results={deepSearch.results}
        running={deepSearch.running}
        isDark={true}
      />

      {/* Grouped cards */}
      <div className="flex-1 min-h-0 overflow-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <CreditCard className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/60">Nessun biglietto da visita</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(group => (
              <div
                key={group.key}
                className={cn(
                  "rounded-xl border overflow-hidden transition-all",
                  group.isMatched ? "border-amber-500/30 bg-amber-500/[0.03]" : "border-border/60 bg-card/40"
                )}
              >
                {/* Group header */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30">
                  {/* Logo */}
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border",
                    group.isMatched ? "border-amber-500/30 bg-amber-500/10" : "border-border/40 bg-muted/30"
                  )}>
                    {group.logoUrl ? (
                      <img src={group.logoUrl} alt="" className="w-7 h-7 rounded object-contain" />
                    ) : (
                      <Building2 className={cn("w-4 h-4", group.isMatched ? "text-amber-500/60" : "text-muted-foreground/40")} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {group.countryCode && <span className="text-4xl leading-none flex-shrink-0" title={group.countryCode}>{countryCodeToFlag(group.countryCode)}</span>}
                      <span className="text-sm font-semibold text-foreground truncate">{group.companyName}</span>
                      {group.isMatched && (
                        <Badge variant="outline" className="text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/30 flex-shrink-0">
                          WCA
                        </Badge>
                      )}
                      {group.hasDeepSearch && (
                        <Brain className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{group.cards.length} contatt{group.cards.length === 1 ? "o" : "i"}</span>
                  </div>

                  {/* Select all in group */}
                  <button
                    onClick={() => {
                      const ids = group.cards.map(c => c.id);
                      const allInGroup = ids.every(id => selectedBca.has(id));
                      setSelectedBca(prev => {
                        const next = new Set(prev);
                        ids.forEach(id => allInGroup ? next.delete(id) : next.add(id));
                        return next;
                      });
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border/30 hover:bg-muted/40 transition-all"
                  >
                    {group.cards.every(c => selectedBca.has(c.id)) ? "Deseleziona" : "Seleziona"}
                  </button>
                </div>

                {/* Contact cards inside group */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
                  {group.cards.map(card => {
                    const isSelected = selectedBca.has(card.id);
                    return (
                      <div
                        key={card.id}
                        className={cn(
                          "relative rounded-lg border p-3 cursor-pointer transition-all duration-150 hover:shadow-sm",
                          isSelected
                            ? "ring-1 ring-amber-500/50 border-amber-500/40 bg-amber-500/5 shadow-sm shadow-amber-500/10"
                            : "border-border/40 bg-background/50 hover:border-border"
                        )}
                        onClick={() => toggleBca(card.id)}
                      >
                        <div className="flex items-start gap-2.5">
                          <Checkbox checked={isSelected} className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {(() => { const cc = group.countryCode || guessCountryFromLocation(card.location, card.phone || card.mobile); return cc ? <span className="text-3xl leading-none flex-shrink-0">{countryCodeToFlag(cc)}</span> : null; })()}
                              <p className="text-sm font-semibold text-foreground truncate">
                                {card.contact_name || "—"}
                              </p>
                            </div>
                            {card.position && <p className="text-[11px] text-muted-foreground truncate">{card.position}</p>}

                            <div className="flex flex-col gap-0.5 mt-1.5">
                              {card.email && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                  <Mail className="w-2.5 h-2.5 flex-shrink-0" /> {card.email}
                                </span>
                              )}
                              {(card.phone || card.mobile) && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Phone className="w-2.5 h-2.5 flex-shrink-0" /> {card.mobile || card.phone}
                                </span>
                              )}
                              {card.event_name && (
                                <span className="flex items-center gap-1 text-[10px] text-amber-600">
                                  <Calendar className="w-2.5 h-2.5 flex-shrink-0" /> {card.event_name}
                                  {card.met_at && <span className="text-muted-foreground ml-1">{new Date(card.met_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>}
                                </span>
                              )}
                            </div>
                          </div>
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
