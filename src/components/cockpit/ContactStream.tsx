import { useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, X, Users } from "lucide-react";
import { CockpitContactCard } from "./CockpitContactCard";
import { CockpitContactListItem } from "./CockpitContactListItem";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  onSingleDeepSearch: (id: string) => void;
  onSingleAlias: (id: string) => void;
}

export function ContactStream({
  viewMode, searchQuery, filters, contacts, isLoading,
  onDragStart, onDragEnd,
  selectedIds, onToggle, onSelectAll, onClear, isAllSelected, selectionCount,
  onBulkDeepSearch, onBulkAlias, onSingleDeepSearch, onSingleAlias,
}: ContactStreamProps) {
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
    return result.sort((a, b) => b.priority - a.priority);
  }, [searchQuery, filters, contacts]);

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
        <Users className="w-12 h-12 text-muted-foreground/40" />
        <h3 className="text-sm font-semibold text-foreground/70">Nessun contatto</h3>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Importa contatti, scarica da WCA o aggiungi prospect per popolare il Cockpit.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {/* Header with select-all and bulk actions */}
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
      </div>

      {/* Bulk action bar */}
      {selectionCount > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-1.5 px-1"
        >
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onBulkDeepSearch}>
            <Search className="w-3 h-3" /> Deep Search
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onBulkAlias}>
            <Sparkles className="w-3 h-3" /> Alias
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 ml-auto" onClick={onClear}>
            <X className="w-3 h-3" /> Deseleziona
          </Button>
        </motion.div>
      )}

      {viewMode === "card" ? (
        <div className="space-y-2.5">
          {filteredContacts.map((contact, i) => (
            <CockpitContactCard
              key={contact.id} contact={contact} flag={FLAG[contact.country] || "🌍"} index={i}
              isSelected={selectedIds.has(contact.id)}
              onToggleSelect={() => onToggle(contact.id)}
              onDragStart={() => onDragStart(contact.id)} onDragEnd={onDragEnd}
              onDeepSearch={() => onSingleDeepSearch(contact.id)}
              onAlias={() => onSingleAlias(contact.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-px">
          {filteredContacts.map((contact, i) => (
            <CockpitContactListItem
              key={contact.id} contact={contact} flag={FLAG[contact.country] || "🌍"} index={i}
              isSelected={selectedIds.has(contact.id)}
              onToggleSelect={() => onToggle(contact.id)}
              onDragStart={() => onDragStart(contact.id)} onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
