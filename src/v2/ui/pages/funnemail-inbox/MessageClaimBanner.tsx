/**
 * MessageClaimBanner — banner sopra il lettore mail con stato del claim
 * "Lo prendo io". Mostra chi ha preso il messaggio, da quanto, e azioni
 * di prendi/rilascia/forza (force-claim solo admin).
 */
import * as React from "react";
import { Hand, Undo2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFunnemailClaims } from "@/v2/hooks/useFunnemailClaims";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { cn } from "@/lib/utils";

interface Props {
  messageId: string;
}

/**
 * Flag opzionale per nascondere il banner claim su deployment a singolo
 * operatore. Default = false (nascosto). Quando il team cresce, basta
 * impostare `VITE_FUNNEMAIL_CLAIM_ENABLED=true` per riattivarlo.
 */
const CLAIM_BANNER_ENABLED = String(
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_FUNNEMAIL_CLAIM_ENABLED ?? "",
).toLowerCase() === "true";

export function MessageClaimBanner({ messageId }: Props): React.ReactElement | null {
  if (!CLAIM_BANNER_ENABLED) return null;

  const ctl = useFunnemailClaims(null);
  const { isAdmin } = useAuthV2();
  const claim = ctl.claimsByMessageId.get(messageId) ?? null;
  const claimedByMe = !!claim && claim.claimed_by === ctl.myUserId;
  const claimedByOther = !!claim && !claimedByMe;
  const pending = ctl.pendingMessageId === messageId;

  const minutes = claim
    ? Math.max(0, Math.round((Date.now() - new Date(claim.claimed_at).getTime()) / 60000))
    : 0;

  if (!claim) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
        <span className="text-muted-foreground">Nessuno sta lavorando su questo messaggio.</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          disabled={pending}
          onClick={() => { void ctl.claim({ messageId }); }}
        >
          <Hand className="h-3.5 w-3.5" />Lo prendo io
        </Button>
      </div>
    );
  }

  if (claimedByMe) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-primary/30 bg-primary/10 px-3 py-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-primary">
          <Hand className="h-3.5 w-3.5" />In carico a te da {minutes} min
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          disabled={pending}
          onClick={() => { void ctl.release(messageId); }}
        >
          <Undo2 className="h-3.5 w-3.5" />Rilascia
        </Button>
      </div>
    );
  }

  // claimedByOther
  return (
    <div className={cn(
      "flex items-center justify-between gap-2 border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-xs",
    )}>
      <span className="inline-flex items-center gap-1.5 font-medium text-warning">
        <AlertTriangle className="h-3.5 w-3.5" />
        In carico a {claim.operator_display_name ?? "altro operatore"} da {minutes} min — sola lettura
      </span>
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          disabled={pending}
          onClick={() => { void ctl.forceClaim({ messageId }); }}
          title="Forza presa in carico (admin)"
        >
          <ShieldAlert className="h-3.5 w-3.5" />Forza presa in carico
        </Button>
      )}
    </div>
  );
}