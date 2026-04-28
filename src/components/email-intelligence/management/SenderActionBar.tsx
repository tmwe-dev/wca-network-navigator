/**
 * SenderActionBar — Barra azioni contestuale visibile quando ≥1 sender è selezionato.
 *
 * 6 azioni (riusano i DAL bulkUpdateAutoAction / bulkSetBlocked):
 *  • Regole       → callback al parent (apre RulesConfiguration)
 *  • Segna lette  → also_mark_read = true
 *  • Elimina      → auto_action = 'delete' (con conferma)
 *  • Esporta      → callback al parent (apre ExportSendersDialog)
 *  • Blocca       → is_blocked + auto_action='spam'
 *  • Prompt       → disabilitato (placeholder, prompt bar rimandata)
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Settings2, MailCheck, Trash2, Download, Ban, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bulkUpdateAutoAction, bulkSetBlocked } from "@/data/emailAddressRules";

interface SenderActionBarProps {
  selectedSenders: string[];
  /** Mostrato in label: nome del primo sender o "N sender selezionati" se >1. */
  contextLabel: string;
  onOpenRules: () => void;
  onOpenExport: () => void;
  onActionComplete?: () => void;
}

export function SenderActionBar({
  selectedSenders,
  contextLabel,
  onOpenRules,
  onOpenExport,
  onActionComplete,
}: SenderActionBarProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const withUser = async <T,>(fn: (userId: string) => Promise<T>): Promise<T | null> => {
    const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
    if (!user) {
      toast.error("Sessione scaduta");
      return null;
    }
    return fn(user.id);
  };

  const handleMarkRead = async () => {
    setBusy("mark_read");
    try {
      await withUser((uid) =>
        bulkUpdateAutoAction(uid, selectedSenders, "mark_read", { also_mark_read: true }),
      );
      toast.success(`${selectedSenders.length} mittenti: segna come letto attivato`);
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    try {
      await withUser((uid) => bulkUpdateAutoAction(uid, selectedSenders, "delete"));
      toast.success(`${selectedSenders.length} mittenti: regola di eliminazione impostata`);
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(null);
    }
  };

  const handleBlock = async () => {
    setBusy("block");
    try {
      await withUser((uid) => bulkSetBlocked(uid, selectedSenders, true));
      toast.success(`${selectedSenders.length} mittenti bloccati (spam IMAP attivato)`);
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(null);
    }
  };

  if (selectedSenders.length === 0) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-md bg-secondary/60 border border-border">
        <span className="text-xs font-medium mr-2">
          Azioni per <span className="font-semibold">{contextLabel}</span>:
        </span>

        <Button size="sm" variant="outline" onClick={onOpenRules} disabled={busy !== null}>
          <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Regole
        </Button>

        <Button size="sm" variant="outline" onClick={handleMarkRead} disabled={busy !== null}>
          {busy === "mark_read" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <MailCheck className="h-3.5 w-3.5 mr-1.5" />
          )}
          Segna lette
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy !== null}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Elimina
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Impostare regola di eliminazione?</AlertDialogTitle>
              <AlertDialogDescription>
                Per i {selectedSenders.length} mittenti selezionati l'azione automatica diventerà
                <strong> "elimina"</strong>. Le mail future verranno spostate nel cestino al prossimo
                ciclo di sincronizzazione. Continuare?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDelete(); }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Conferma
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button size="sm" variant="outline" onClick={onOpenExport} disabled={busy !== null}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Esporta
        </Button>

        <Button size="sm" variant="outline" onClick={handleBlock} disabled={busy !== null}>
          {busy === "block" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Ban className="h-3.5 w-3.5 mr-1.5" />
          )}
          Blocca
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button size="sm" variant="outline" disabled>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Prompt
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>In arrivo</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}