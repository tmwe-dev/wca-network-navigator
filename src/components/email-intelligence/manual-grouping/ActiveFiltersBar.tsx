/**
 * ActiveFiltersBar — mostra fuori dal drawer i filtri attualmente attivi
 * per Email Intelligence, con chip rimovibili.
 * Sorgente unica di verità: GlobalFiltersContext (gli stessi che il drawer scrive).
 * Default values per "non attivo":
 *   - emailIntelSearch: "" (vuoto)
 *   - emailIntelVolume: "all"
 *   - emailIntelSort: "count-desc"
 *   - emailIntelHideClassified: true
 */
import { X, Search, Filter as FilterIcon, ArrowUpDown, EyeOff, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

const VOLUME_LABEL: Record<string, string> = {
  "2": ">2 email",
  "5": ">5 email",
  "10": ">10 email",
  "50": ">50 email",
};

const SORT_LABEL: Record<string, string> = {
  "name-asc": "A → Z",
  "name-desc": "Z → A",
  "count-asc": "Meno email",
  "count-desc": "Più email",
  "ai_group": "AI smart",
};

export function ActiveFiltersBar() {
  const g = useGlobalFilters();
  const { emailIntelSearch, emailIntelVolume, emailIntelSort, emailIntelHideClassified } = g.filters;

  const hasSearch = emailIntelSearch.trim().length > 0;
  const hasVolume = emailIntelVolume !== "all";
  const hasSort = emailIntelSort !== "count-desc";
  const hasHideOff = emailIntelHideClassified === false;

  const anyActive = hasSearch || hasVolume || hasSort || hasHideOff;
  if (!anyActive) return null;

  const resetAll = () => {
    g.setFilter("emailIntelSearch", "");
    g.setFilter("emailIntelVolume", "all");
    g.setFilter("emailIntelSort", "count-desc");
    g.setFilter("emailIntelHideClassified", true);
  };

  return (
    <div
      data-testid="email-intel-active-filters"
      className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/50 bg-muted/30"
    >
      <span className="text-[11px] font-medium text-muted-foreground mr-1">Filtri attivi:</span>

      {hasSearch && (
        <FilterChip
          icon={<Search className="h-3 w-3" />}
          label={`"${emailIntelSearch}"`}
          onRemove={() => g.setFilter("emailIntelSearch", "")}
        />
      )}
      {hasVolume && (
        <FilterChip
          icon={<FilterIcon className="h-3 w-3" />}
          label={VOLUME_LABEL[emailIntelVolume] ?? emailIntelVolume}
          onRemove={() => g.setFilter("emailIntelVolume", "all")}
        />
      )}
      {hasSort && (
        <FilterChip
          icon={<ArrowUpDown className="h-3 w-3" />}
          label={SORT_LABEL[emailIntelSort] ?? emailIntelSort}
          onRemove={() => g.setFilter("emailIntelSort", "count-desc")}
        />
      )}
      {hasHideOff && (
        <FilterChip
          icon={<EyeOff className="h-3 w-3" />}
          label="Mostra anche classificati"
          onRemove={() => g.setFilter("emailIntelHideClassified", true)}
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground ml-auto"
        onClick={resetAll}
      >
        <Eraser className="h-3 w-3 mr-1" />
        Reset
      </Button>
    </div>
  );
}

function FilterChip(props: { icon: React.ReactNode; label: string; onRemove: () => void }) {
  return (
    <Badge
      variant="secondary"
      className="h-6 gap-1 pl-1.5 pr-1 text-[11px] font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20"
    >
      <span className="opacity-80">{props.icon}</span>
      <span className="max-w-[160px] truncate">{props.label}</span>
      <button
        type="button"
        onClick={props.onRemove}
        aria-label={`Rimuovi filtro ${props.label}`}
        className="ml-0.5 rounded-sm p-0.5 hover:bg-primary/30 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}