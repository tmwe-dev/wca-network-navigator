/**
 * BackfillButton — pulsante "Applica allo storico" per address o gruppo.
 *
 * Mostra un dialog di conferma con il numero stimato di address coinvolti,
 * lancia la edge function `backfill-email-rules` e mostra un toast finale
 * con il report `{ matched, applied, errors }`.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { backfillForAddress, backfillForGroup } from "@/data/emailRulesBackfill";
import type { BackfillReport } from "@/data/emailRulesBackfill";

interface BackfillButtonProps {
  scope: "address" | "group";
  /** email_address oppure group_name */
  target: string;
  /** Numero approssimativo di address (per group) o 1 per address singolo */
  addressCount?: number;
  /** Visivo: icon-only o full-button */
  variant?: "icon" | "button";
  /** Etichetta personalizzabile per il pulsante */
  label?: string;
  className?: string;
  onComplete?: (report: BackfillReport) => void;
}

export function BackfillButton({
  scope,
  target,
  addressCount,
  variant = "button",
  label,
  className,
  onComplete,
}: BackfillButtonProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const run = async () => {
    try {
      setRunning(true);
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) {
        toast.error("Sessione scaduta");
        return;
      }
      // operator_id è opzionale (regole legacy hanno operator_id NULL).
      // Restringiamo se disponibile, altrimenti filtriamo solo per user.
      const { data: opRow } = await supabase
        .from("operators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const operatorId = opRow?.id ?? undefined;

      const report = scope === "address"
        ? await backfillForAddress(user.id, target, false, operatorId)
        : await backfillForGroup(user.id, target, false, operatorId);

      const errCount = report.errors.length;
      const truncatedNote = report.truncated ? " (lista troncata: rilancia per processare i restanti)" : "";
      if (report.messages_applied > 0) {
        toast.success(
          `Backfill: ${report.messages_applied} messaggi processati su ${report.addresses_processed} address${truncatedNote}` +
          (errCount > 0 ? ` — ${errCount} errori` : ""),
        );
      } else if (report.messages_matched > 0) {
        toast.info(`Backfill: ${report.messages_matched} messaggi trovati ma 0 applicati${truncatedNote}`);
      } else {
        toast.info("Backfill: nessun messaggio storico trovato");
      }
      onComplete?.(report);
    } catch (err) {
      toast.error(`Errore backfill: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
      setOpen(false);
    }
  };

  const description = scope === "address"
    ? `Verranno cercati nella inbox IMAP tutti i messaggi storici di "${target}" e applicate le regole IMAP configurate. L'operazione può richiedere alcuni minuti. Continuare?`
    : `Verranno processati ${addressCount ?? "N"} address del gruppo "${target}". Per ogni address con regola IMAP attiva, tutti i messaggi storici nella inbox verranno trattati. L'operazione può richiedere alcuni minuti. Continuare?`;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 ${className ?? ""}`}
            title="Applica regole allo storico IMAP"
            disabled={running}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className={`gap-1.5 ${className ?? ""}`}
            disabled={running}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Inbox className="h-3.5 w-3.5" />}
            {label ?? "Applica allo storico"}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Backfill regole IMAP</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); run(); }} disabled={running}>
            {running ? "In corso…" : "Esegui"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}