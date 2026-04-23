/**
 * AtlasSidebar — Avatar + metadata dell'agente selezionato + lista agenti per categoria.
 */
import { useMemo } from "react";
import * as Icons from "lucide-react";
import type { AgentRegistryEntry, AgentCategory } from "@/data/agentPrompts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AtlasSidebarProps {
  agents: ReadonlyArray<AgentRegistryEntry>;
  selectedId: string;
  onSelect: (id: string) => void;
}

const COLOR_MAP: Record<AgentRegistryEntry["avatarColor"], string> = {
  primary: "bg-primary/15 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  muted: "bg-muted text-foreground",
  destructive: "bg-destructive/15 text-destructive",
};

const ROLE_LABEL: Record<string, string> = {
  oracolo: "Oracolo",
  genera: "Genera",
  migliora: "Migliora",
  giornalista: "Giornalista",
  voce: "Voce",
  codice: "Codice",
  worker: "Worker",
  classifier: "Classificatore",
};

const CATEGORY_ORDER: AgentCategory[] = [
  "core", "email", "outreach", "analysis", "voice", "autonomous", "classifier",
];

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  core: "Core",
  email: "Email",
  outreach: "Outreach",
  analysis: "Analisi",
  voice: "Voice",
  autonomous: "Autonomi",
  classifier: "Classificatori",
};

export function AtlasSidebar({ agents, selectedId, onSelect }: AtlasSidebarProps) {
  const selected = agents.find((a) => a.id === selectedId);

  const grouped = useMemo(() => {
    const m = new Map<AgentCategory, AgentRegistryEntry[]>();
    for (const a of agents) {
      if (!m.has(a.category)) m.set(a.category, []);
      m.get(a.category)!.push(a);
    }
    return m;
  }, [agents]);

  const SelectedIcon = selected
    ? ((Icons as unknown as Record<string, Icons.LucideIcon>)[selected.avatarIcon] ?? Icons.Bot)
    : Icons.Bot;

  return (
    <aside className="bg-muted/30 flex w-72 shrink-0 flex-col overflow-hidden border-r">
      {/* Avatar + Identity card */}
      {selected && (
        <div className="border-b p-4">
          <div className="flex items-start gap-3">
            <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", COLOR_MAP[selected.avatarColor])}>
              <SelectedIcon className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">{selected.displayName}</h2>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[9px]">
                  {CATEGORY_LABEL[selected.category]}
                </Badge>
                <Badge variant="secondary" className="text-[9px]">
                  {ROLE_LABEL[selected.roleInModel] ?? selected.roleInModel}
                </Badge>
              </div>
            </div>
          </div>

          {/* Runtime meta compact */}
          <div className="mt-3 space-y-1 text-[10px]">
            {selected.runtime.edgeFunction && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Edge fn</span>
                <code className="bg-muted truncate rounded px-1 py-0.5">{selected.runtime.edgeFunction}</code>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Modello</span>
              <code className="bg-muted truncate rounded px-1 py-0.5">{selected.runtime.modelDefault}</code>
            </div>
          </div>
        </div>
      )}

      {/* Agent list */}
      <nav className="flex-1 space-y-2 overflow-auto p-2">
        {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => (
          <div key={category}>
            <div className="text-muted-foreground mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider">
              {CATEGORY_LABEL[category]}
            </div>
            <ul className="space-y-0.5">
              {grouped.get(category)!.map((a) => {
                const Ico = (Icons as unknown as Record<string, Icons.LucideIcon>)[a.avatarIcon] ?? Icons.Bot;
                const isActive = a.id === selectedId;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => onSelect(a.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      <Ico className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{a.displayName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
