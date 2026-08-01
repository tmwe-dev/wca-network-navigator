/**
 * DeepSearchEmailButton — pulsante riutilizzabile per lanciare Deep Search
 * (Sherlock) su un'email. Apre un menu con i 3 livelli (Scout / Detective /
 * Sherlock) e poi mostra `SherlockLauncherDialog` con autoStart.
 *
 * Funziona anche senza partner_id/contact_id: usa l'adapter
 * `buildEmailDeepSearchTarget` per costruire il target.
 */
import * as React from "react";
import { Search, ScanSearch, Telescope } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SherlockLauncherDialog, type SherlockLauncherTarget } from "./SherlockLauncherDialog";
import { buildEmailDeepSearchTarget, type BuildEmailTargetOpts } from "./deepSearchEmailAdapter";
import type { SherlockLevel } from "@/v2/services/sherlock/sherlockTypes";

interface Props {
  email: string;
  /** Dati opzionali per arricchire il target (no DB lookup automatico). */
  source?: Omit<BuildEmailTargetOpts, "email">;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  /** Etichetta breve. Default: "Deep Search". */
  label?: string;
  /** Callback al termine della Deep Search (riceve la sintesi). */
  onComplete?: (summary: string | null) => void;
}

export function DeepSearchEmailButton({
  email, source, size = "sm", variant = "outline", className, label = "Deep Search", onComplete,
}: Props): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [level, setLevel] = React.useState<SherlockLevel | undefined>(undefined);
  const [target, setTarget] = React.useState<SherlockLauncherTarget | null>(null);

  const launch = (lvl: SherlockLevel) => {
    if (!email) return;
    setTarget(buildEmailDeepSearchTarget({ email, ...(source ?? {}) }));
    setLevel(lvl);
    setOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant={variant} className={className} disabled={!email}>
            <Search className="mr-1.5 h-3.5 w-3.5" /> {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => launch(1)} className="gap-2 text-xs">
            <Search className="h-3.5 w-3.5" /> Scout <span className="ml-auto text-[10px] text-muted-foreground">~30s</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => launch(2)} className="gap-2 text-xs">
            <ScanSearch className="h-3.5 w-3.5" /> Detective <span className="ml-auto text-[10px] text-muted-foreground">~2min</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => launch(3)} className="gap-2 text-xs">
            <Telescope className="h-3.5 w-3.5" /> Sherlock <span className="ml-auto text-[10px] text-muted-foreground">~5min</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SherlockLauncherDialog
        open={open}
        onOpenChange={setOpen}
        target={target}
        autoStartLevel={level}
        onComplete={onComplete}
      />
    </>
  );
}

export default DeepSearchEmailButton;