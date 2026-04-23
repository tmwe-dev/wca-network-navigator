/**
 * AgentAtlasPage — Mappa visuale agenti × prompt × KB.
 *
 * Read-only: ogni agente del sistema (incluso Optimus, Cockpit, Voice, Journalists)
 * mostra a sinistra avatar+identità, a destra colonne Prompt / KB / Tools / Contract.
 * Da ogni blocco si salta nell'editor del Prompt Lab esistente (no doppio editor).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGENT_REGISTRY, type AgentCategory } from "@/data/agentPrompts";
import { AgentSidebar } from "./AgentSidebar";
import { AgentDetail } from "./AgentDetail";

const CATEGORY_LABEL: Record<AgentCategory | "all", string> = {
  all: "Tutti",
  conversational: "Conversational",
  generative: "Generative",
  classification: "Classification",
  reviewer: "Reviewer",
  scraper: "Scraper",
  voice: "Voice",
  worker: "Worker",
  strategy: "Strategy",
};

export default function AgentAtlasPage() {
  const allAgents = useMemo(() => Object.values(AGENT_REGISTRY), []);
  const [filter, setFilter] = useState<AgentCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string>(allAgents[0]?.id ?? "");

  const filteredAgents = useMemo(
    () => (filter === "all" ? allAgents : allAgents.filter((a) => a.category === filter)),
    [allAgents, filter],
  );

  const selected = useMemo(
    () => allAgents.find((a) => a.id === selectedId) ?? filteredAgents[0] ?? allAgents[0],
    [allAgents, filteredAgents, selectedId],
  );

  const categories: ReadonlyArray<AgentCategory | "all"> = [
    "all", "conversational", "generative", "classification",
    "reviewer", "scraper", "voice", "worker",
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="h-7 px-2">
            <Link to="/v2/prompt-lab">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Prompt Lab
            </Link>
          </Button>
          <span className="text-muted-foreground text-xs">/</span>
          <h1 className="text-sm font-semibold">Agent Atlas</h1>
          <span className="text-muted-foreground text-xs">
            — mappa runtime di {allAgents.length} agenti
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={filter === c ? "default" : "outline"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setFilter(c)}
            >
              {CATEGORY_LABEL[c]}
            </Button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <AgentSidebar
          agents={filteredAgents}
          selectedId={selected?.id ?? ""}
          onSelect={setSelectedId}
        />
        <div className="flex-1 overflow-auto">
          {selected ? (
            <AgentDetail agent={selected} />
          ) : (
            <div className="text-muted-foreground p-8 text-sm">
              Nessun agente in questa categoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
