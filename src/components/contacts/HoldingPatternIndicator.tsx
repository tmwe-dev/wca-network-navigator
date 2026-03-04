import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/hooks/useContacts";

const PHASES: { key: LeadStatus; label: string; color: string }[] = [
  { key: "new", label: "Nuovo", color: "bg-muted-foreground" },
  { key: "contacted", label: "Contattato", color: "bg-primary" },
  { key: "in_progress", label: "In corso", color: "bg-warning" },
  { key: "negotiation", label: "Trattativa", color: "bg-chart-3" },
  { key: "converted", label: "Cliente", color: "bg-success" },
];

const ORDER = PHASES.map((p) => p.key);

interface Props {
  status: LeadStatus;
  onChangeStatus?: (s: LeadStatus) => void;
  compact?: boolean;
}

export function HoldingPatternIndicator({ status, onChangeStatus, compact }: Props) {
  if (status === "lost") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-medium">
        <X className="w-3 h-3" /> Perso
      </div>
    );
  }

  const activeIdx = ORDER.indexOf(status);

  return (
    <div className={cn("flex items-center", compact ? "gap-1" : "gap-2")}>
      {PHASES.map((phase, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        const future = idx > activeIdx;

        return (
          <button
            key={phase.key}
            type="button"
            disabled={!onChangeStatus}
            onClick={() => onChangeStatus?.(phase.key)}
            className={cn(
              "flex items-center gap-1 rounded-full border transition-all text-[10px] font-medium",
              compact ? "px-1.5 py-0.5" : "px-2.5 py-1",
              done && "border-transparent bg-success/20 text-success",
              active && `border-transparent ${phase.color} text-white shadow-sm`,
              future && "border-border bg-muted/50 text-muted-foreground",
              onChangeStatus && "cursor-pointer hover:scale-105"
            )}
            title={phase.label}
          >
            {done && <Check className="w-3 h-3" />}
            {!compact && <span>{phase.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
