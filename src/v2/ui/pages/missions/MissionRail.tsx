/**
 * MissionRail — rail SINISTRO della maschera Missioni.
 * Solo navigazione: ricerca + elenco missioni con pallino di stato.
 * Nessun contatore, nessun riepilogo (contratto: maschera operativa).
 */
import * as React from "react";
import { Plus, Search, Rocket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/v2/ui/molecules/StatusDot";
import { cn } from "@/lib/utils";
import { statusMeta } from "./missionMeta";
import type { AgentMissionRow } from "@/data/agentMissions";

export interface MissionRailProps {
  readonly missions: readonly AgentMissionRow[];
  readonly isLoading: boolean;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onCreate: () => void;
}

export function MissionRail({
  missions,
  isLoading,
  selectedId,
  onSelect,
  onCreate,
}: MissionRailProps): React.ReactElement {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return missions;
    return missions.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        (m.goal_description ?? "").toLowerCase().includes(q) ||
        statusMeta(m.status).label.toLowerCase().includes(q),
    );
  }, [missions, query]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-card/40">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca missione"
            aria-label="Cerca missione"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={onCreate} aria-label="Nuova missione">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-muted/30" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Rocket className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {query ? "Nessuna missione trovata." : "Nessuna missione. Creane una."}
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {filtered.map((m) => {
              const meta = statusMeta(m.status);
              const active = m.id === selectedId;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(m.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                      active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/30",
                    )}
                  >
                    <StatusDot tone={meta.tone} label={meta.label} />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs",
                        active ? "font-semibold text-foreground" : "text-foreground/90",
                      )}
                    >
                      {m.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default MissionRail;
