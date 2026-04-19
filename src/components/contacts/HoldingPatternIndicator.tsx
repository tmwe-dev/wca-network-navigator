import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/hooks/useContacts";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Tassonomia 9 stati — pipeline visivo (escluse fasi terminali archived/blacklisted gestite a parte)
const PHASES: { key: LeadStatus; label: string; color: string }[] = [
  { key: "new", label: "Nuovo", color: "bg-muted-foreground" },
  { key: "first_touch_sent", label: "Primo contatto", color: "bg-primary" },
  { key: "holding", label: "In attesa", color: "bg-warning" },
  { key: "engaged", label: "Agganciato", color: "bg-info" },
  { key: "qualified", label: "Qualificato", color: "bg-chart-2" },
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
  const [confirmTarget, setConfirmTarget] = useState<LeadStatus | null>(null);

  if (status === "archived") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-medium">
        <X className="w-3 h-3" /> Archiviato
      </div>
    );
  }

  if (status === "blacklisted") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/30 text-destructive text-xs font-medium">
        <X className="w-3 h-3" /> Blacklist
      </div>
    );
  }

  const activeIdx = ORDER.indexOf(status);

  const handleClick = (targetKey: LeadStatus) => {
    if (!onChangeStatus) return;
    // If already at or past this status, warn
    const targetIdx = ORDER.indexOf(targetKey);
    if (targetIdx <= activeIdx && targetKey !== status) {
      setConfirmTarget(targetKey);
    } else {
      onChangeStatus(targetKey);
    }
  };

  return (
    <>
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
              onClick={() => handleClick(phase.key)}
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

      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma cambio stato</AlertDialogTitle>
            <AlertDialogDescription>
              Questo contatto è già stato portato allo stato "{PHASES.find(p => p.key === status)?.label}".
              Vuoi davvero riportarlo a "{PHASES.find(p => p.key === confirmTarget)?.label}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmTarget) onChangeStatus?.(confirmTarget);
              setConfirmTarget(null);
            }}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
