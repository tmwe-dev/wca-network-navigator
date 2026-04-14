import { useMemo, useState } from "react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

import { Search, Sparkles, X, Users, Trash2, Linkedin, Loader2, Plane } from "lucide-react";
import { CockpitContactCard, type EnrichmentState, type AssignmentInfo } from "./CockpitContactCard";
import { CockpitContactListItem } from "./CockpitContactListItem";
import { ContactActionMenu } from "./ContactActionMenu";
import { BulkActionMenu } from "./BulkActionMenu";
import { TodayActivityCarousel } from "./TodayActivityCarousel";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { RecordSourceType } from "@/contexts/ContactDrawerContext";
import type { ViewMode, CockpitFilter } from "@/pages/Cockpit";
import type { CockpitContact } from "@/hooks/useCockpitContacts";

const FLAG: Record<string, string> = {
  IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", JP: "🇯🇵", RU: "🇷🇺", US: "🇺🇸",
  CN: "🇨🇳", BR: "🇧🇷", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹", PT: "🇵🇹", PL: "🇵🇱",
  TR: "🇹🇷", IN: "🇮🇳", AE: "🇦🇪", SA: "🇸🇦", KR: "🇰🇷", AU: "🇦🇺", CA: "🇨🇦", MX: "🇲🇽",
};


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
  viewMode, searchQuery, onSearchChange: _onSearchChange, filters, contacts, isLoading,
  onDragStart, onDragEnd,
  selectedIds, onToggle, onSelectAll, onClear, isAllSelected, selectionCount,
  onBulkDeepSearch, onBulkAlias, onBulkLinkedInLookup, isLinkedInLookupRunning, onSingleDeepSearch, onSingleAlias, onSingleLinkedInLookup, onBulkDelete, onBatchMode, activeContactId, enrichmentState, assignmentMap,
}: ContactStreamProps) {
  const [hideHolding, setHideHolding] = useState(true);
  const { filters: gf } = useGlobalFilters();

  const isInHolding = (c: CockpitContact) => {
    return !!c.leadStatus && c.leadStatus !== "new";
  };

  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
      );
    }
    for (const f of filters) {
      if (f.type === "language" && f.id.includes("it")) result = result.filter(c => c.language === "italiano");
      if (f.type === "channel" && f.label.toLowerCase().includes("linkedin")) result = result.filter(c => c.channels.includes("linkedin"));
      if (f.type === "priority") result = result.filter(c => c.priority >= 7);
    }
    if (hideHolding) {
      result = result.filter(c => !isInHolding(c));
    }
    // Cockpit sidebar filters
    if (gf.cockpitCountries.size > 0) {
      result = result.filter(c => gf.cockpitCountries.has(c.country?.toUpperCase() || "??"));
    }
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
    // Sort
    const sortBy = gf.sortBy || "priority";
    if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "company") result.sort((a, b) => a.company.localeCompare(b.company));
    else if (sortBy === "country") result.sort((a, b) => a.country.localeCompare(b.country));
    else result.sort((a, b) => b.priority - a.priority);
    return result;
  }, [searchQuery, filters, contacts, hideHolding, gf.cockpitCountries, gf.cockpitChannels, gf.cockpitQuality, gf.sortBy]);

  // Get selected contacts for bulk actions
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
    <div className="p-3 space-y-2">
      {/* Today activity carousel */}
      <TodayActivityCarousel />

      {/* Header with select-all, hide-worked toggle, and count */}
      <div className="flex items-center justify-between px-1 mb-1 gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={(checked) => checked ? onSelectAll() : onClear()}
            className="h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-foreground/80">
            {selectionCount > 0 ? `${selectionCount} selezionati` : `${filteredContacts.length} contatti`}
          </span>
        </div>
        <button
          onClick={() => setHideHolding(!hideHolding)}
          className={cn(
            "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors",
            hideHolding
              ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={hideHolding ? "Mostra tutti" : "Nascondi in circuito"}
        >
          <Plane className="w-3 h-3" />
          {hideHolding ? "In circuito nascosti" : "Nascondi in circuito"}
        </button>
      </div>

      {/* Bulk action bar — fixed height, horizontal scroll, never wraps */}
      <div className={cn(
        "h-8 flex items-center gap-1 px-1 overflow-x-auto scrollbar-none transition-opacity",
        selectionCount > 0 ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <BulkActionMenu selectedContacts={selectedContacts} onComplete={onClear} />
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2 shrink-0" onClick={onBulkDeepSearch}>
          <Search className="w-3 h-3" /> Deep Search
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2 shrink-0" onClick={onBulkAlias}>
          <Sparkles className="w-3 h-3" /> Alias
        </Button>
        {onBulkLinkedInLookup && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2 shrink-0" onClick={onBulkLinkedInLookup} disabled={isLinkedInLookupRunning}>
            {isLinkedInLookupRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Linkedin className="w-3 h-3" />} LinkedIn
          </Button>
        )}
        {onBatchMode && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2 shrink-0 text-primary" onClick={onBatchMode}>
            <Sparkles className="w-3 h-3" /> Genera
          </Button>
        )}
        {onBulkDelete && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2 shrink-0 text-destructive hover:bg-destructive/10" onClick={onBulkDelete}>
            <Trash2 className="w-3 h-3" /> Elimina
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5 shrink-0 ml-auto" onClick={onClear}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      {viewMode === "card" ? (
        <div className="space-y-2.5">
          {filteredContacts.map((contact, i) => (
            <div key={contact.id} className="relative group">
              <CockpitContactCard
                contact={contact} flag={FLAG[contact.country] || "🌍"} index={i}
                isSelected={selectedIds.has(contact.id)}
                isWorked={isInHolding(contact)}
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
  );
}
