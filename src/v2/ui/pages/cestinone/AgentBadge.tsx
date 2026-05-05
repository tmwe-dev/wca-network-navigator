import * as React from "react";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resolveAgentAvatar } from "@/data/agentAvatars";

export function AgentBadge({ name, size = "sm" }: { name: string; size?: "sm" | "md" }): React.ReactElement {
  const avatar = resolveAgentAvatar(name);
  const dim = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <Badge variant="secondary" className="text-[9px] gap-1 pl-0.5" title={`Agente: ${name}`}>
      {avatar ? (
        <img src={avatar} alt="" className={cn(dim, "rounded-full object-cover ring-1 ring-background")} />
      ) : (
        <Bot className={cn(dim)} />
      )}
      <span className="truncate max-w-[100px] capitalize">{name}</span>
    </Badge>
  );
}

export function EmptyPane({ label }: { label: string }): React.ReactElement {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function CheckRow({ ok, warn, label, detail }: { ok: boolean; warn?: boolean; label: string; detail?: string }): React.ReactElement {
  const tone = warn
    ? "text-amber-600 dark:text-amber-400"
    : ok
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-muted-foreground";
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={cn("mt-0.5 inline-block h-2 w-2 rounded-full shrink-0", tone, ok && !warn ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-muted-foreground")} />
      <div className="min-w-0">
        <div className={cn("font-medium", tone)}>{label}</div>
        {detail && <div className="text-[10px] text-muted-foreground truncate">{detail}</div>}
      </div>
    </div>
  );
}