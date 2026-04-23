/**
 * AgentAvatarCard — Header card a sinistra: avatar grande + identità + runtime meta.
 */
import * as Icons from "lucide-react";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const COLOR_CLASSES: Record<AgentRegistryEntry["avatarColor"], string> = {
  primary: "bg-primary/15 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  muted: "bg-muted text-foreground",
  destructive: "bg-destructive/15 text-destructive",
};

export function AgentAvatarCard({ agent }: { agent: AgentRegistryEntry }) {
  const Ico = (Icons as unknown as Record<string, Icons.LucideIcon>)[agent.avatarIcon] ?? Icons.Bot;
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-4 text-center">
      <div className={cn("flex h-20 w-20 items-center justify-center rounded-full", COLOR_CLASSES[agent.avatarColor])}>
        <Ico className="h-10 w-10" />
      </div>
      <div>
        <h2 className="text-sm font-semibold">{agent.displayName}</h2>
        <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
          {agent.description}
        </p>
      </div>
      <div className="w-full space-y-1.5 border-t pt-3 text-left text-[11px]">
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground">Edge fn</span>
          <code className="bg-muted truncate rounded px-1 py-0.5 text-[10px]" title={agent.runtime.edgeFunction}>
            {agent.runtime.edgeFunction}
          </code>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground">Modello</span>
          <code className="bg-muted truncate rounded px-1 py-0.5 text-[10px]" title={agent.runtime.modelDefault}>
            {agent.runtime.modelDefault}
          </code>
        </div>
        <div>
          <span className="text-muted-foreground">Trigger</span>
          <ul className="mt-0.5 space-y-0.5">
            {agent.runtime.triggers.map((t, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-muted-foreground">·</span>
                <span className="leading-snug">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="pt-1">
          <Badge variant="outline" className="text-[10px]">
            {agent.category}
          </Badge>
        </div>
      </div>
    </div>
  );
}
