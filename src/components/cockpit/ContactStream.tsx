import { useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, X, Users, Trash2 } from "lucide-react";
import { CockpitContactCard } from "./CockpitContactCard";
import { CockpitContactListItem } from "./CockpitContactListItem";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ViewMode, CockpitFilter, ContactOrigin } from "@/pages/Cockpit";
import type { CockpitContact } from "@/hooks/useCockpitContacts";

const FLAG: Record<string, string> = {
  IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", JP: "🇯🇵", RU: "🇷🇺", US: "🇺🇸",
  CN: "🇨🇳", BR: "🇧🇷", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹", PT: "🇵🇹", PL: "🇵🇱",
  TR: "🇹🇷", IN: "🇮🇳", AE: "🇦🇪", SA: "🇸🇦", KR: "🇰🇷", AU: "🇦🇺", CA: "🇨🇦", MX: "🇲🇽",
};

const ORIGIN_CONFIG: { key: ContactOrigin; label: string; color: string; activeColor: string }[] = [
  { key: "wca", label: "WCA", color: "text-blue-400/60 border-blue-500/20", activeColor: "text-blue-300 bg-blue-500/20 border-blue-400/50" },
  { key: "import", label: "Import", color: "text-emerald-400/60 border-emerald-500/20", activeColor: "text-emerald-300 bg-emerald-500/20 border-emerald-400/50" },
  { key: "report_aziende", label: "Prospect", color: "text-amber-400/60 border-amber-500/20", activeColor: "text-amber-300 bg-amber-500/20 border-amber-400/50" },
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
  onSingleDeepSearch: (id: string) => void;
  onSingleAlias: (id: string) => void;
  onBulkDelete?: () => void;
  visibleOrigins: Set<ContactOrigin>;
  onToggleOrigin: (origin: ContactOrigin) => void;
}

export function ContactStream({
  viewMode, searchQuery, onSearchChange, filters, contacts, isLoading,
  onDragStart, onDragEnd,
  selectedIds, onToggle, onSelectAll, onClear, isAllSelected, selectionCount,
  onBulkDeepSearch, onBulkAlias, onSingleDeepSearch, onSingleAlias, onBulkDelete,
  visibleOrigins, onToggleOrigin,
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
