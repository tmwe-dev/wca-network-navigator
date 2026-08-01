/**
 * PageTitleHint — Titolo pagina con icona ⓘ tooltip.
 * Standard riusabile per pagine admin/config: titolo compatto,
 * spiegazione "cosa è / cosa puoi fare" on-hover.
 */
import * as React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PageTitleHintProps {
  title: string;
  hint: string;
  className?: string;
  /** Opzionale: badge/azioni alla destra del titolo. */
  right?: React.ReactNode;
}

export function PageTitleHint({ title, hint, className, right }: PageTitleHintProps): React.ReactElement {
  return (
    <div className={cn("flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/40", className)}>
      <div className="flex items-center gap-1.5 min-w-0">
        <h2 className="text-sm font-semibold truncate">{title}</h2>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Cosa è questa pagina"
                className="inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors h-5 w-5"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-sm text-xs leading-relaxed">
              {hint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {right ? <div className="flex items-center gap-1.5 shrink-0">{right}</div> : null}
    </div>
  );
}