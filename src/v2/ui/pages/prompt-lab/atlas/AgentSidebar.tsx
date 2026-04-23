/**
 * AgentSidebar — Lista agenti raggruppati per categoria.
 */
import { useMemo } from "react";
import * as Icons from "lucide-react";
import type { AgentRegistryEntry, AgentCategory } from "@/data/agentPrompts";
import { cn } from "@/lib/utils";

interface AgentSidebarProps {
  agents: ReadonlyArray<AgentRegistryEntry>;
  selectedId: string;
  onSelect: (id: string) => void;
}

const CATEGORY_ORDER: AgentCategory[] = [
  "conversational", "generative", "classification",
  "reviewer", "scraper", "voice", "worker", "strategy",
];

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  conversational: "Conversational",
  generative: "Generative",
  classification: "Classification",
  reviewer: "Reviewer",
  scraper: "Scraper",
  voice: "Voice",
  worker: "Worker",
  strategy: "Strategy",
};

export function AgentSidebar({ agents, selectedId, onSelect }: AgentSidebarProps) {
  const grouped = useMemo(() => {
    const m = new Map<AgentCategory, AgentRegistryEntry[]>();
    for (const a of agents) {
      if (!m.has(a.category)) m.set(a.category, []);
      m.get(a.category)!.push(a);
    }
    return m;
  }, [agents]);

  return (
    <aside className="bg-muted/30 w-64 shrink-0 overflow-auto border-r">
      <nav className="space-y-3 p-2">
        {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => (
          <div key={category}>
            <div className="text-muted-foreground mb-1 px-2 text-[10px] font-semibold tracking-wider uppercase">
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
