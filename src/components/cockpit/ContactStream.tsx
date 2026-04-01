import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, X, Users, Trash2, EyeOff, Eye, Linkedin, Loader2 } from "lucide-react";
import { CockpitContactCard, type EnrichmentState, type AssignmentInfo } from "./CockpitContactCard";
import { CockpitContactListItem } from "./CockpitContactListItem";
import { ContactActionMenu } from "./ContactActionMenu";
import { BulkActionMenu } from "./BulkActionMenu";
import { TodayActivityCarousel } from "./TodayActivityCarousel";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useWorkedToday } from "@/hooks/useWorkedToday";
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
  onBulkDeepSearch, onBulkAlias, onBulkLinkedInLookup, isLinkedInLookupRunning, onSingleDeepSearch, onSingleAlias, onBulkDelete, onBatchMode, activeContactId, enrichmentState, assignmentMap,
}: ContactStreamProps) {
  const [hideWorked, setHideWorked] = useState(false);
  const { workedIds } = useWorkedToday();

  // Helper to check if a contact's source_id was worked today
  const isContactWorked = (c: CockpitContact) => {
    return workedIds.has(c.partnerId || c.sourceId);
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
    // Hide worked filter
    if (hideWorked) {
      result = result.filter(c => !isContactWorked(c));
    }
    return result.sort((a, b) => b.priority - a.priority);
  }, [searchQuery, filters, contacts, hideWorked, workedIds]);

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

      {/* Search field */}
      <div className="px-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cerca contatto, azienda..."
            className="w-full h-8 pl-8 pr-8 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground transition-colors" />
            </button>
          )}
        </div>
      </div>

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
          {/* Bulk activity actions (mark done, note, schedule) */}
          <BulkActionMenu selectedContacts={selectedContacts} onComplete={onClear} />
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onBulkDeepSearch}>
            <Search className="w-3 h-3" /> Deep Search
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onBulkAlias}>
            <Sparkles className="w-3 h-3" /> Alias
          </Button>
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

      {viewMode === "card" ? (
        <div className="space-y-2.5">
          {filteredContacts.map((contact, i) => (
            <div key={contact.id} className="relative group">
              <CockpitContactCard
                contact={contact} flag={FLAG[contact.country] || "🌍"} index={i}
                isSelected={selectedIds.has(contact.id)}
                isWorked={isContactWorked(contact)}
                assignment={assignmentMap?.get(contact.partnerId || contact.sourceId)}
                onToggleSelect={() => onToggle(contact.id)}
                onDragStart={() => onDragStart(contact.id)} onDragEnd={onDragEnd}
                onDeepSearch={() => onSingleDeepSearch(contact.id)}
                onAlias={() => onSingleAlias(contact.id)}
                enrichmentState={activeContactId === contact.id ? enrichmentState : undefined}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ContactActionMenu contact={contact} />
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
