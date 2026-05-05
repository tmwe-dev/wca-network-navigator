/**
 * DeepSearchEmailBulkButton — lancia Deep Search in serie su un set di email.
 *
 * Esegue una sola indagine alla volta (riusa `SherlockLauncherDialog` con
 * autoStart) e mostra un piccolo progress-bar testuale. Pensato per
 * AISuggestionsTab e simili: nessuna scrittura side-effect oltre a quella già
 * fatta dal motore Sherlock per ciascun target.
 */
import * as React from "react";
import { Search, ScanSearch, Telescope, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SherlockLauncherDialog, type SherlockLauncherTarget } from "./SherlockLauncherDialog";
import { buildEmailDeepSearchTarget, type BuildEmailTargetOpts } from "./deepSearchEmailAdapter";
import type { SherlockLevel } from "@/v2/services/sherlock/sherlockTypes";
import { toast } from "sonner";

interface Props {
  /** Set di email da analizzare (e opzionali metadata). */
  items: Array<{ email: string } & Omit<BuildEmailTargetOpts, "email">>;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  label?: string;
  disabled?: boolean;
}

export function DeepSearchEmailBulkButton({
  items, size = "sm", variant = "outline", className, label, disabled,
}: Props): React.ReactElement {
  const [queue, setQueue] = React.useState<typeof items>([]);
  const [idx, setIdx] = React.useState(0);
  const [level, setLevel] = React.useState<SherlockLevel>(1);
  const [open, setOpen] = React.useState(false);
  const stopRef = React.useRef(false);

  const current = queue[idx];
  const target: SherlockLauncherTarget | null = React.useMemo(() => {
    if (!current) return null;
    return buildEmailDeepSearchTarget(current);
  }, [current]);

  const start = (lvl: SherlockLevel) => {
    if (!items.length) return;
    stopRef.current = false;
    setLevel(lvl);
    setQueue(items);
    setIdx(0);
    setOpen(true);
  };

  // Quando l'utente chiude il dialog, avanza alla prossima email (o termina).
  const handleOpenChange = (next: boolean) => {
    if (next) { setOpen(true); return; }
    setOpen(false);
    if (stopRef.current) {
      toast.info(`Bulk Deep Search interrotto (${idx + 1}/${queue.length})`);
      setQueue([]);
      return;
    }
    if (idx + 1 < queue.length) {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      // Riapri brevemente dopo per la prossima
      setTimeout(() => setOpen(true), 250);
    } else if (queue.length) {
      toast.success(`Bulk Deep Search completato (${queue.length} target)`);
      setQueue([]);
    }
  };

  const stop = () => { stopRef.current = true; setOpen(false); };

  const buttonLabel = label ?? `Deep Search${items.length ? ` (${items.length})` : ""}`;

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size={size} variant={variant} className={className} disabled={disabled || !items.length || queue.length > 0}>
              <Search className="mr-1.5 h-3.5 w-3.5" /> {buttonLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => start(1)} className="gap-2 text-xs">
              <Search className="h-3.5 w-3.5" /> Scout <span className="ml-auto text-[10px] text-muted-foreground">~30s</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => start(2)} className="gap-2 text-xs">
              <ScanSearch className="h-3.5 w-3.5" /> Detective <span className="ml-auto text-[10px] text-muted-foreground">~2min</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => start(3)} className="gap-2 text-xs">
              <Telescope className="h-3.5 w-3.5" /> Sherlock <span className="ml-auto text-[10px] text-muted-foreground">~5min</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {queue.length > 0 && (
          <>
            <span className="text-[11px] text-muted-foreground">
              {idx + 1}/{queue.length}: {current?.email}
            </span>
            <Button size="sm" variant="destructive" className="h-7" onClick={stop}>
              <Square className="mr-1 h-3 w-3 fill-current" /> Stop
            </Button>
          </>
        )}
      </div>

      <SherlockLauncherDialog
        open={open}
        onOpenChange={handleOpenChange}
        target={target}
        autoStartLevel={level}
      />
    </>
  );
}

export default DeepSearchEmailBulkButton;