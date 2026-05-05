import * as React from "react";
import type { AgentRegistryEntry, AgentCategory } from "@/data/agentPrompts";
import { cn } from "@/lib/utils";
import { CATEGORY_ORDER, CATEGORY_LABEL } from "./constants";

export function Sidebar({
  open, grouped, selectedId, onSelect,
}: {
  open: boolean;
  grouped: Map<AgentCategory, AgentRegistryEntry[]>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside
      className={cn(
        "border-r bg-muted/20 transition-all duration-200 flex flex-col overflow-hidden",
        open ? "w-64" : "w-0",
      )}
    >
      <nav className="flex-1 overflow-auto p-2 space-y-2">
        {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
          <div key={cat}>
            <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABEL[cat]}
            </div>
            <ul className="space-y-0.5">
              {grouped.get(cat)!.map((a) => {
                const active = a.id === selectedId;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => onSelect(a.id)}
                      className={cn(
                        "w-full text-left rounded px-2 py-1.5 text-xs transition-colors truncate",
                        active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {a.displayName}
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