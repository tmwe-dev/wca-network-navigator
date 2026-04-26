/**
 * EmailIntelligenceHeader — Titolo + ricerca + pulsante "Nuovo gruppo".
 * Componente "presentazionale": riceve callbacks dal parent.
 */
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, BrainCircuit } from "lucide-react";

interface EmailIntelligenceHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCreateGroup: () => void;
  /** Es. "12 da smistare · 248 classificati" */
  countLabel?: string;
}

export function EmailIntelligenceHeader({
  searchQuery,
  onSearchChange,
  onCreateGroup,
  countLabel,
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
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
          <BrainCircuit className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">Gestione Manuale</h2>
          {countLabel && (
            <p className="text-[11px] text-muted-foreground leading-tight">{countLabel}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end max-w-xl">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Cerca emittente…"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={onCreateGroup}>
          <Plus className="h-4 w-4 mr-1" />
          Nuovo gruppo
        </Button>
      </div>
    </div>
  );
}