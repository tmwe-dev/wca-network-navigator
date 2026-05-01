/**
 * SourcePill — Badge sorgente standardizzato per tutto Outreach.
 * Manuale / AI / Campagna / Missione / Sequenza, con colore consistente.
 */
import { User, Sparkles, Megaphone, Target, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

export type SourceKind = "manual" | "ai" | "campaign" | "mission" | "sequence" | "unknown";

const MAP: Record<SourceKind, { label: string; icon: typeof User; cls: string }> = {
  manual:   { label: "Manuale",  icon: User,      cls: "bg-muted text-muted-foreground border-border" },
  ai:       { label: "AI",       icon: Sparkles,  cls: "bg-primary/15 text-primary border-primary/30" },
  campaign: { label: "Campagna", icon: Megaphone, cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  mission:  { label: "Missione", icon: Target,    cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  sequence: { label: "Sequenza", icon: Repeat,    cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  unknown:  { label: "—",        icon: User,      cls: "bg-muted text-muted-foreground border-border" },
};

/** Risolve la sorgente partendo dai campi grezzi DB. */
export function resolveSource(raw: {
  sourceType?: string | null;
  executedByAgentId?: string | null;
  cadenceRule?: unknown;
}): SourceKind {
  if (raw.cadenceRule) return "sequence";
  if (raw.executedByAgentId) return "ai";
  const s = (raw.sourceType || "").toLowerCase();
  if (s.includes("ai") || s === "agent" || s === "ai_agent") return "ai";
  if (s.includes("campaign") || s.includes("campagna")) return "campaign";
  if (s.includes("mission")) return "mission";
  if (s.includes("sequence") || s.includes("cadence")) return "sequence";
  if (s === "partner" || s === "manual" || s === "user") return "manual";
  return "unknown";
}

interface SourcePillProps {
  readonly kind: SourceKind;
  readonly compact?: boolean;
  readonly className?: string;
  readonly customLabel?: string;
}

export function SourcePill({ kind, compact = false, className, customLabel }: SourcePillProps) {
  const cfg = MAP[kind];
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-medium",
      compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5",
      cfg.cls,
      className,
    )}>
      <Icon className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {customLabel ?? cfg.label}
    </span>
  );
}
