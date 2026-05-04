/**
 * FunnemailGroupHeader — header collassabile di un gruppo nella lista mail
 * con menu Azioni di gruppo (segna lette / assegna gruppo / archivia / elimina).
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, MailOpen, Tag, Archive, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEmailAddressGroups } from "@/hooks/useEmailAddressGroups";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  busy?: boolean;
  onMarkAllRead: () => void;
  onAssignGroup: (groupName: string) => void;
  onArchiveAll: () => void;
  onDeleteAll: () => void;
}

const CONFIRM_THRESHOLD = 20;

export function FunnemailGroupHeader({
  label, count, expanded, onToggle, busy,
  onMarkAllRead, onAssignGroup, onArchiveAll, onDeleteAll,
}: Props) {
  const { data: groupsList } = useEmailAddressGroups();
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);

  const requireConfirm = (action: "archive" | "delete") => {
    if (count > CONFIRM_THRESHOLD) {
      setConfirm(action);
    } else {
      action === "archive" ? onArchiveAll() : onDeleteAll();
    }
  };

  return (
    <>
      <div className={cn(
        "sticky top-0 z-10 flex items-center gap-1 border-b border-border bg-muted/70 px-2 py-1.5 backdrop-blur",
      )}>
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-1.5 text-left"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="truncate text-xs font-semibold">{label}</span>
          <span className="rounded-full bg-background px-1.5 py-0 text-[10px] font-bold text-muted-foreground">
            {count}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Azioni gruppo">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onMarkAllRead}>
              <MailOpen className="h-3.5 w-3.5 mr-2" />Segna tutte come lette
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag className="h-3.5 w-3.5 mr-2" />Assegna gruppo a tutte…
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-auto">
                {(!groupsList || groupsList.length === 0) && (
                  <DropdownMenuItem disabled>Nessun gruppo definito</DropdownMenuItem>
                )}
                {(groupsList ?? []).map((g) => (
                  <DropdownMenuItem
                    key={g.groupName}
                    onClick={() => onAssignGroup(g.groupName)}
                  >
                    {g.groupIcon && <span className="mr-2">{g.groupIcon}</span>}
                    <span>{g.groupName}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => requireConfirm("archive")}>
              <Archive className="h-3.5 w-3.5 mr-2" />Archivia tutte
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => requireConfirm("delete")}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />Elimina tutte (cestino)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              {confirm === "archive" ? "Archiviare" : "Cestinare"} {count} email di "{label}"?
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
                if (confirm === "archive") onArchiveAll();
                else if (confirm === "delete") onDeleteAll();
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
