/**
 * PromptColumn — Lista verticale dei blocchi prompt che alimentano l'agente.
 * Ogni blocco linka all'editor del Prompt Lab esistente (no doppio editor).
 */
import { Link } from "react-router-dom";
import { ExternalLink, FileText } from "lucide-react";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import { Button } from "@/components/ui/button";

export function PromptColumn({ agent }: { agent: AgentRegistryEntry }) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <FileText className="text-muted-foreground h-3.5 w-3.5" />
          <h3 className="text-xs font-semibold">Prompt sources ({agent.promptSources.length})</h3>
        </div>
      </header>
      <ul className="divide-y">
        {agent.promptSources.length === 0 && (
          <li className="text-muted-foreground px-3 py-4 text-xs italic">
            Nessuna sorgente prompt registrata.
          </li>
        )}
        {agent.promptSources.map((src, i) => (
          <li key={i} className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{src.label}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-[10px]" title={src.source}>
                  {src.source}
                </p>
                {src.hint && (
                  <p className="text-muted-foreground mt-0.5 text-[10px] italic">{src.hint}</p>
                )}
              </div>
              <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-[10px]">
                <Link to={`/v2/prompt-lab?tab=${src.promptLabTab}`} title="Apri nell'editor del Prompt Lab">
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
