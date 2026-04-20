/**
 * RegenerateBanner — banner sticky riusabile mostrato dopo un save in KB/Sender/Doctrine/Prompts.
 * Cliccando "Re-genera mail" triggera forgeLabStore.triggerRun() per feedback immediato sulla mail.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { forgeLabStore } from "@/v2/hooks/useForgeLabStore";

interface Props {
  visible: boolean;
  message?: string;
  onDismiss?: () => void;
}

export function RegenerateBanner({ visible, message = "Modifica salvata", onDismiss }: Props) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-0 -mx-2 mt-2 flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 backdrop-blur">
      <div className="text-[11px] text-primary font-medium">{message} · ri-genera per vedere l'effetto</div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          onClick={() => { forgeLabStore.triggerRun(); onDismiss?.(); }}
          className="h-6 text-[10px] gap-1"
        >
          <Sparkles className="w-3 h-3" /> Re-genera mail
        </Button>
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss} className="h-6 w-6 p-0">
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
