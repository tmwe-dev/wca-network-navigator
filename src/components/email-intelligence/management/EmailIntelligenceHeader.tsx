/**
 * EmailIntelligenceHeader — Toolbar del tab "Gestione Manuale":
 * ricerca + counter "N da smistare · N classificati" + pulsante "Nuovo gruppo".
 *
 * Il titolo principale ("Email Intelligence") sta nella shell della pagina:
 * qui NON ripetiamo titolo/icona per evitare doppi header.
 */
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, RefreshCw, Loader2 } from "lucide-react";

interface EmailIntelligenceHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCreateGroup: () => void;
  /** Callback per aggiornare/ripopolare i mittenti dal DB. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function EmailIntelligenceHeader({
  searchQuery,
  onSearchChange,
  onCreateGroup,
  onRefresh,
  isRefreshing = false,
}: EmailIntelligenceHeaderProps) {
  // Debounce locale 200ms per evitare re-render eccessivi sul rail di card.
  const [local, setLocal] = useState(searchQuery);
  useEffect(() => setLocal(searchQuery), [searchQuery]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== searchQuery) onSearchChange(local);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9"
          placeholder="Cerca emittente…"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing} title="Aggiorna mittenti">
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onCreateGroup}>
        <Plus className="h-4 w-4 mr-1" />
        Nuovo gruppo
      </Button>
      </div>
    </div>
  );
}