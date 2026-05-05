/**
 * FunnemailBulkBar — barra azioni che appare in fondo alla lista quando
 * l'utente ha selezionato 1+ email tramite checkbox.
 *
 * Stile uniforme alle altre maschere: pulsante "Azioni" + popover Assegna gruppo.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MailOpen, Tag, Archive, Trash2, X, Loader2, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/providers/AuthProvider";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  count: number;
  busy: boolean;
  onClear: () => void;
  onMarkRead: () => void;
  onAssignGroup: (groupName: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  /** ID dei messaggi selezionati per la classificazione retroattiva. */
  selectedIds?: string[];
}

interface SenderGroupRow {
  nome_gruppo: string;
  colore: string | null;
  icon: string | null;
}

const CONFIRM_THRESHOLD = 20;

export function FunnemailBulkBar({
  count, busy, onClear, onMarkRead, onAssignGroup, onArchive, onDelete, selectedIds,
}: Props) {
  const { user } = useAuth();
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [classifying, setClassifying] = useState(false);

  const runRetroClassify = async () => {
    if (!selectedIds?.length) return;
    setClassifying(true);
    try {
      const res = await invokeEdge("classify-emails-batch", {
        message_ids: selectedIds,
      }) as { ok: boolean; total: number; processed: number; errors: number };
      toast.success(`Classificate ${res.processed}/${res.total}${res.errors ? ` · ${res.errors} errori` : ""}`);
    } catch (e) {
      toast.error(`Classificazione fallita: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClassifying(false);
    }
  };

  const { data: groupsList = [] } = useQuery({
    queryKey: ["email-sender-groups", "list", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SenderGroupRow[]> => {
      const { data } = await untypedFrom("email_sender_groups")
        .select("nome_gruppo, colore, icon")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      return (data ?? []) as SenderGroupRow[];
    },
  });

  const requireConfirm = (action: "archive" | "delete") => {
    if (count > CONFIRM_THRESHOLD) setConfirm(action);
    else action === "archive" ? onArchive() : onDelete();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-muted/80 px-2 py-1.5 backdrop-blur">
        <span className="text-[11px] font-semibold text-foreground">
          {count} selezionata{count === 1 ? "" : "e"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm" variant="ghost"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onMarkRead} disabled={busy}
            title="Segna come lette"
          >
            <MailOpen className="h-3.5 w-3.5" /> Lette
          </Button>

          {selectedIds && selectedIds.length > 0 && (
            <Button
              size="sm" variant="ghost"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={runRetroClassify}
              disabled={busy || classifying}
              title="Classifica retroattivamente le email selezionate"
            >
              {classifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Classifica
            </Button>
          )}

          <Popover open={groupOpen} onOpenChange={setGroupOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm" variant="ghost"
                className="h-7 gap-1 px-2 text-[11px]"
                disabled={busy}
                title="Assegna gruppo"
              >
                <Tag className="h-3.5 w-3.5" /> Gruppo
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <p className="px-1 pb-1.5 text-[11px] font-semibold text-muted-foreground">
                Assegna {count} mittente/i a:
              </p>
              <div className="flex max-h-64 flex-col overflow-auto rounded-md border border-border/60 divide-y divide-border/40">
                {groupsList.length === 0 && (
                  <p className="px-2.5 py-2 text-[11px] italic text-muted-foreground">
                    Nessun gruppo definito.
                  </p>
                )}
                {groupsList.map((g) => (
                  <button
                    key={g.nome_gruppo}
                    type="button"
                    onClick={() => { onAssignGroup(g.nome_gruppo); setGroupOpen(false); }}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors",
                      "hover:bg-muted/60 text-foreground",
                    )}
                  >
                    {g.icon ? (
                      <span className="w-5 text-center text-base leading-none">{g.icon}</span>
                    ) : (
                      <span
                        className="h-3 w-3 rounded-full border border-border/60"
                        style={{ backgroundColor: g.colore ?? "transparent" }}
                      />
                    )}
                    <span className="flex-1 truncate">{g.nome_gruppo}</span>
                    <Check className="h-3.5 w-3.5 opacity-0" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="sm" variant="ghost"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() => requireConfirm("archive")} disabled={busy}
            title="Archivia tutte"
          >
            <Archive className="h-3.5 w-3.5" /> Archivia
          </Button>
          <Button
            size="sm" variant="ghost"
            className="h-7 gap-1 px-2 text-[11px] text-destructive hover:text-destructive"
            onClick={() => requireConfirm("delete")} disabled={busy}
            title="Cestina tutte (soft-delete)"
          >
            <Trash2 className="h-3.5 w-3.5" /> Cestina
          </Button>

          <Button
            size="sm" variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClear} disabled={busy}
            title="Annulla selezione"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              {confirm === "archive" ? "Archiviare" : "Cestinare"} {count} email selezionate?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {confirm === "archive"
                ? "Le email verranno spostate nella cartella Archive (operazione reversibile)."
                : "Le email verranno spostate nel cestino (soft-delete, recuperabili dal Trash)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === "archive") onArchive();
                else if (confirm === "delete") onDelete();
                setConfirm(null);
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}