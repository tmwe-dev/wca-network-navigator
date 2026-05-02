/**
 * AgendaFiltersTab — Linguetta verticale fissa sul bordo sinistro della pagina.
 * Apre/chiude lo Sheet dei filtri (calendario + tipo + stato risposta).
 * Mostra un dot quando ci sono filtri attivi diversi dal default.
 */
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaFiltersTabProps {
  onClick: () => void;
  hasActiveFilters: boolean;
}

export default function AgendaFiltersTab({ onClick, hasActiveFilters }: AgendaFiltersTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Apri filtri agenda"
      className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 z-20",
        "flex items-center gap-1.5 px-1.5 py-3",
        "rounded-r-lg border border-l-0 border-border/40",
        "bg-card/80 backdrop-blur-sm hover:bg-card transition-colors",
        "shadow-sm",
      )}
    >
      <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
      <span
        className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        Filtri
      </span>
      {hasActiveFilters && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </button>
  );
}