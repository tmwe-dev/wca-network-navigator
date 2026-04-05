import { useMemo, useState, useCallback } from "react";
import { useGlobalFilters, type CockpitChannelFilter, type CockpitQualityFilter } from "@/contexts/GlobalFiltersContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Sparkles, X, Users, Trash2, EyeOff, Eye, Linkedin, Loader2,
  SlidersHorizontal, ArrowUpDown, Globe, Mail, Phone, MessageSquare,
  Shield, ChevronDown, ChevronUp, Filter, RotateCcw, Check,
} from "lucide-react";
import { CockpitContactCard, type EnrichmentState, type AssignmentInfo } from "./CockpitContactCard";
import { CockpitContactListItem } from "./CockpitContactListItem";
import { ContactActionMenu } from "./ContactActionMenu";
import { BulkActionMenu } from "./BulkActionMenu";
import { TodayActivityCarousel } from "./TodayActivityCarousel";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useWorkedToday } from "@/hooks/useWorkedToday";
import type { RecordSourceType } from "@/contexts/ContactDrawerContext";
import type { ViewMode, CockpitFilter } from "@/pages/Cockpit";
import type { CockpitContact } from "@/hooks/useCockpitContacts";

const FLAG: Record<string, string> = {
  IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", JP: "🇯🇵", RU: "🇷🇺", US: "🇺🇸",
  CN: "🇨🇳", BR: "🇧🇷", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹", PT: "🇵🇹", PL: "🇵🇱",
  TR: "🇹🇷", IN: "🇮🇳", AE: "🇦🇪", SA: "🇸🇦", KR: "🇰🇷", AU: "🇦🇺", CA: "🇨🇦", MX: "🇲🇽",
};

const SORT_OPTIONS = [
  { value: "priority", label: "Priorità", icon: "🔥" },
  { value: "name", label: "Nome", icon: "🔤" },
  { value: "company", label: "Azienda", icon: "🏢" },
  { value: "country", label: "Paese", icon: "🌍" },
  { value: "recent", label: "Recente", icon: "🕐" },
];

const CHANNEL_FILTERS: { value: CockpitChannelFilter; label: string; icon: React.ReactNode }[] = [
  { value: "with_email", label: "Email", icon: <Mail className="w-3 h-3" /> },
  { value: "with_linkedin", label: "LinkedIn", icon: <Linkedin className="w-3 h-3" /> },
  { value: "with_phone", label: "Telefono", icon: <Phone className="w-3 h-3" /> },
  { value: "with_whatsapp", label: "WhatsApp", icon: <MessageSquare className="w-3 h-3" /> },
];

const QUALITY_FILTERS: { value: CockpitQualityFilter; label: string }[] = [
  { value: "enriched", label: "Arricchiti" },
  { value: "not_enriched", label: "Non arricchiti" },
  { value: "with_alias", label: "Con alias" },
  { value: "no_alias", label: "Senza alias" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovi" },
  { value: "contacted", label: "Contattati" },
  { value: "qualified", label: "Qualificati" },
  { value: "lost", label: "Persi" },
];

const ORIGIN_OPTIONS = [
  { value: "wca", label: "WCA", color: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
  { value: "import", label: "Import", color: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" },
  { value: "report_aziende", label: "Report", color: "bg-amber-500/15 border-amber-500/30 text-amber-400" },
  { value: "bca", label: "BCA", color: "bg-purple-500/15 border-purple-500/30 text-purple-400" },
  { value: "manual", label: "Manuale", color: "bg-rose-500/15 border-rose-500/30 text-rose-400" },
];

interface ContactStreamProps {
  viewMode: ViewMode;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filters: CockpitFilter[];
  contacts: CockpitContact[];
  isLoading: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  isAllSelected: boolean;
  selectionCount: number;
  onBulkDeepSearch: () => void;
  onBulkAlias: () => void;
  onBulkLinkedInLookup?: () => void;
  isLinkedInLookupRunning?: boolean;
  onSingleDeepSearch: (id: string) => void;
  onSingleAlias: (id: string) => void;
  onSingleLinkedInLookup?: (id: string) => void;
  onBulkDelete?: () => void;
  onBatchMode?: () => void;
  activeContactId?: string | null;
  enrichmentState?: EnrichmentState;
  assignmentMap?: Map<string, AssignmentInfo>;
}

export function ContactStream({
  viewMode, searchQuery, onSearchChange, filters, contacts, isLoading,
  onDragStart, onDragEnd,
  selectedIds, onToggle, onSelectAll, onClear, isAllSelected, selectionCount,
  onBulkDeepSearch, onBulkAlias, onBulkLinkedInLookup, isLinkedInLookupRunning, onSingleDeepSearch, onSingleAlias, onSingleLinkedInLookup, onBulkDelete, onBatchMode, activeContactId, enrichmentState, assignmentMap,
}: ContactStreamProps) {
  const [hideWorked, setHideWorked] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const { workedIds } = useWorkedToday();
  const g = useGlobalFilters();
  const gf = g.filters;

  const isContactWorked = (c: CockpitContact) => workedIds.has(c.partnerId || c.sourceId);

  // Derive unique countries from contacts
  const countryStats = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach(c => {
      const code = c.country?.toUpperCase() || "??";
      map.set(code, (map.get(code) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count, flag: FLAG[code] || "🌍" }));
  }, [contacts]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (gf.cockpitCountries.size > 0) c++;
    if (gf.cockpitChannels.size > 0) c++;
    if (gf.cockpitQuality.size > 0) c++;
    if (gf.cockpitStatus !== "all") c++;
    if (localSearch) c++;
    if (hideWorked) c++;
    return c;
  }, [gf.cockpitCountries, gf.cockpitChannels, gf.cockpitQuality, gf.cockpitStatus, localSearch, hideWorked]);

  const toggleCountry = useCallback((code: string) => {
    const next = new Set(gf.cockpitCountries);
    if (next.has(code)) next.delete(code); else next.add(code);
    g.setCockpitCountries(next);
  }, [gf.cockpitCountries, g]);

  const toggleChannel = useCallback((val: CockpitChannelFilter) => {
    const next = new Set(gf.cockpitChannels);
    if (next.has(val)) next.delete(val); else next.add(val);
    g.setCockpitChannels(next);
  }, [gf.cockpitChannels, g]);

  const toggleQuality = useCallback((val: CockpitQualityFilter) => {
    const next = new Set(gf.cockpitQuality);
    if (next.has(val)) next.delete(val); else next.add(val);
    g.setCockpitQuality(next);
  }, [gf.cockpitQuality, g]);

  const resetAllFilters = useCallback(() => {
    g.setCockpitCountries(new Set());
    g.setCockpitChannels(new Set());
    g.setCockpitQuality(new Set());
    g.setCockpitStatus("all");
    setLocalSearch("");
    setHideWorked(false);
  }, [g]);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    // Local search
    const q = (localSearch || searchQuery).toLowerCase();
    if (q) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) || c.country?.toLowerCase().includes(q)
      );
    }
    for (const f of filters) {
      if (f.type === "language" && f.id.includes("it")) result = result.filter(c => c.language === "italiano");
      if (f.type === "channel" && f.label.toLowerCase().includes("linkedin")) result = result.filter(c => c.channels.includes("linkedin"));
      if (f.type === "priority") result = result.filter(c => c.priority >= 7);
    }
    if (hideWorked) result = result.filter(c => !isContactWorked(c));
    // Country
    if (gf.cockpitCountries.size > 0) {
      result = result.filter(c => gf.cockpitCountries.has(c.country?.toUpperCase() || "??"));
    }
    // Channels
    if (gf.cockpitChannels.size > 0) {
      result = result.filter(c => {
        for (const ch of gf.cockpitChannels) {
          if (ch === "with_email" && !c.email) return false;
          if (ch === "with_linkedin" && !c.linkedinUrl) return false;
          if (ch === "with_phone" && !c.phone) return false;
          if (ch === "with_whatsapp" && !c.phone) return false;
        }
        return true;
      });
    }
    // Quality
    if (gf.cockpitQuality.size > 0) {
      result = result.filter(c => {
        for (const q of gf.cockpitQuality) {
          if (q === "enriched" && !c.deepSearchAt) return false;
          if (q === "not_enriched" && c.deepSearchAt) return false;
          if (q === "with_alias" && !c.contactAlias && !c.companyAlias) return false;
          if (q === "no_alias" && (c.contactAlias || c.companyAlias)) return false;
        }
        return true;
      });
    }
    // Status
    if (gf.cockpitStatus && gf.cockpitStatus !== "all") {
      result = result.filter(c => (c as any).leadStatus === gf.cockpitStatus);
    }
    // Sort
    const sortBy = gf.sortBy || "priority";
    if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "company") result.sort((a, b) => a.company.localeCompare(b.company));
    else if (sortBy === "country") result.sort((a, b) => a.country.localeCompare(b.country));
    else if (sortBy === "recent") result.sort((a, b) => (b.lastContact || "").localeCompare(a.lastContact || ""));
    else result.sort((a, b) => b.priority - a.priority);
    return result;
  }, [localSearch, searchQuery, filters, contacts, hideWorked, workedIds, gf]);

  const selectedContacts = useMemo(() =>
    contacts.filter(c => selectedIds.has(c.id)),
  [contacts, selectedIds]);

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
        <Users className="w-12 h-12 text-muted-foreground/60" />
        <h3 className="text-sm font-semibold text-foreground/80">Nessun contatto</h3>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Importa contatti, scarica da WCA o aggiungi prospect per popolare il Cockpit.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── SEARCH + FILTER TOGGLE ── */}
      <div className="px-3 pt-3 pb-1 space-y-2 border-b border-border/30 bg-background/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              placeholder="Cerca nome, azienda, email..."
              className="pl-8 h-8 text-xs bg-muted/20 border-border/40"
            />
            {localSearch && (
              <button onClick={() => setLocalSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Button
            variant={filtersOpen ? "default" : "outline"}
            size="sm"
            className={cn("h-8 gap-1 text-xs px-2.5", filtersOpen && "bg-primary text-primary-foreground")}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="bg-primary-foreground/20 text-[10px] px-1 rounded-full font-bold">{activeFilterCount}</span>
            )}
          </Button>
        </div>

        {/* ── SORT BAR ── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          <ArrowUpDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => g.setSortBy(opt.value)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors",
                gf.sortBy === opt.value
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FILTER PANEL (collapsible) ── */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-border/30 flex-shrink-0"
          >
            <div className="px-3 py-3 space-y-3 bg-muted/10">
              {/* Countries */}
              {countryStats.length > 0 && (
                <FilterGroup label="Paesi" icon={<Globe className="w-3 h-3" />}>
                  <div className="flex flex-wrap gap-1">
                    {countryStats.slice(0, 12).map(({ code, count, flag }) => (
                      <button
                        key={code}
                        onClick={() => toggleCountry(code)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors border",
                          gf.cockpitCountries.has(code)
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "border-border/30 text-muted-foreground hover:bg-muted/40"
                        )}
                      >
                        <span>{flag}</span>
                        <span>{code}</span>
                        <span className="text-[9px] opacity-60">{count}</span>
                      </button>
                    ))}
                    {gf.cockpitCountries.size > 0 && (
                      <button onClick={() => g.setCockpitCountries(new Set())} className="text-[10px] text-destructive hover:underline px-1">
                        ✕
                      </button>
                    )}
                  </div>
                </FilterGroup>
              )}

              {/* Channels */}
              <FilterGroup label="Canali disponibili" icon={<Mail className="w-3 h-3" />}>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNEL_FILTERS.map(ch => (
                    <button
                      key={ch.value}
                      onClick={() => toggleChannel(ch.value)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                        gf.cockpitChannels.has(ch.value)
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "border-border/30 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {ch.icon} {ch.label}
                    </button>
                  ))}
                </div>
              </FilterGroup>

              {/* Quality */}
              <FilterGroup label="Qualità dati" icon={<Shield className="w-3 h-3" />}>
                <div className="flex flex-wrap gap-1.5">
                  {QUALITY_FILTERS.map(qf => (
                    <button
                      key={qf.value}
                      onClick={() => toggleQuality(qf.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                        gf.cockpitQuality.has(qf.value)
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "border-border/30 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {qf.label}
                    </button>
                  ))}
                </div>
              </FilterGroup>

              {/* Status */}
              <FilterGroup label="Stato lead" icon={<Filter className="w-3 h-3" />}>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(st => (
                    <button
                      key={st.value}
                      onClick={() => g.setCockpitStatus(st.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                        gf.cockpitStatus === st.value
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "border-border/30 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </FilterGroup>

              {/* Origin */}
              <FilterGroup label="Origine" icon={<Globe className="w-3 h-3" />}>
                <div className="flex flex-wrap gap-1.5">
                  {ORIGIN_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const next = new Set(gf.origin);
                        if (next.has(opt.value)) { if (next.size > 1) next.delete(opt.value); }
                        else next.add(opt.value);
                        g.setOrigin(next);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border flex items-center gap-1",
                        gf.origin.has(opt.value) ? opt.color : "border-border/30 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {gf.origin.has(opt.value) && <Check className="w-3 h-3" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterGroup>

              {/* Reset */}
              {activeFilterCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="flex items-center gap-1.5 text-[11px] text-destructive hover:underline"
                >
                  <RotateCcw className="w-3 h-3" /> Reset filtri ({activeFilterCount})
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <TodayActivityCarousel />

        {/* Header row */}
        <div className="flex items-center justify-between px-1 mb-1 gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={(checked) => checked ? onSelectAll() : onClear()}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs font-medium text-foreground/80">
              {selectionCount > 0 ? `${selectionCount} sel.` : `${filteredContacts.length} contatti`}
            </span>
          </div>
          <button
            onClick={() => setHideWorked(!hideWorked)}
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors",
              hideWorked
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={hideWorked ? "Mostra tutti" : "Nascondi lavorati"}
          >
            {hideWorked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {hideWorked ? "Tutti" : "Nascondi lavorati"}
          </button>
        </div>

        {/* Bulk action bar */}
        {selectionCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 px-1 flex-wrap"
          >
            <BulkActionMenu selectedContacts={selectedContacts} onComplete={onClear} />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onBulkDeepSearch}>
              <Search className="w-3 h-3" /> Deep Search
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onBulkAlias}>
              <Sparkles className="w-3 h-3" /> Alias
            </Button>
            {onBulkLinkedInLookup && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onBulkLinkedInLookup} disabled={isLinkedInLookupRunning}>
                {isLinkedInLookupRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Linkedin className="w-3 h-3" />} LinkedIn
              </Button>
            )}
            {onBatchMode && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-primary" onClick={onBatchMode}>
                <Sparkles className="w-3 h-3" /> Genera
              </Button>
            )}
            {onBulkDelete && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-destructive hover:bg-destructive/10" onClick={onBulkDelete}>
                <Trash2 className="w-3 h-3" /> Elimina
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 ml-auto" onClick={onClear}>
              <X className="w-3 h-3" /> Deseleziona
            </Button>
          </motion.div>
        )}

        {/* Contact list */}
        {filteredContacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Nessun contatto con i filtri attuali</p>
            <button onClick={resetAllFilters} className="text-xs text-primary hover:underline mt-1">Reset filtri</button>
          </div>
        ) : viewMode === "card" ? (
          <div className="space-y-2.5">
            {filteredContacts.map((contact, i) => (
              <div key={contact.id} className="relative group">
                <CockpitContactCard
                  contact={contact} flag={FLAG[contact.country] || "🌍"} index={i}
                  isSelected={selectedIds.has(contact.id)}
                  isWorked={isContactWorked(contact)}
                  assignment={assignmentMap?.get(contact.partnerId || contact.sourceId)}
                  sourceType={contact.sourceType as RecordSourceType}
                  sourceId={contact.sourceId}
                  onToggleSelect={() => onToggle(contact.id)}
                  onDragStart={() => onDragStart(contact.id)} onDragEnd={onDragEnd}
                  onDeepSearch={() => onSingleDeepSearch(contact.id)}
                  onAlias={() => onSingleAlias(contact.id)}
                  onLinkedInLookup={onSingleLinkedInLookup ? () => onSingleLinkedInLookup(contact.id) : undefined}
                  enrichmentState={activeContactId === contact.id ? enrichmentState : undefined}
                />
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div className="bg-card/90 backdrop-blur-sm rounded-md border border-border/50">
                    <ContactActionMenu contact={contact} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-px">
            {filteredContacts.map((contact, i) => (
              <div key={contact.id} className="relative group flex items-center">
                <div className="flex-1">
                  <CockpitContactListItem
                    contact={contact} flag={FLAG[contact.country] || "🌍"} index={i}
                    isSelected={selectedIds.has(contact.id)}
                    onToggleSelect={() => onToggle(contact.id)}
                    onDragStart={() => onDragStart(contact.id)} onDragEnd={onDragEnd}
                  />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                  <ContactActionMenu contact={contact} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </div>
  );
}
