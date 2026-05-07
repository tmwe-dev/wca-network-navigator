import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSharedMailboxes,
  listOperatorMailboxAccess,
  setOperatorMailboxAccess,
} from "@/data/mailboxes";
import { queryKeys } from "@/lib/queryKeys";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Editor inline degli accessi alle caselle aziendali per un singolo operatore.
 * Solo admin può modificarlo (RLS lato DB enforce).
 */
export function OperatorMailboxAccessEditor({ operatorId }: { operatorId: string }) {
  const qc = useQueryClient();
  const { data: mailboxes = [], isLoading: loadingMb } = useQuery({
    queryKey: queryKeys.email.mailboxesAll,
    queryFn: listSharedMailboxes,
  });
  const { data: access = [], isLoading: loadingAcc } = useQuery({
    queryKey: queryKeys.email.operatorAccess(operatorId),
    queryFn: () => listOperatorMailboxAccess(operatorId),
  });

  const mutate = useMutation({
    mutationFn: (ids: string[]) => setOperatorMailboxAccess(operatorId, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.email.operatorAccess(operatorId) });
      qc.invalidateQueries({ queryKey: queryKeys.email.mailboxes });
      toast.success("Accessi aggiornati");
    },
    onError: (e: unknown) => toast.error(`Errore: ${(e as Error).message}`),
  });

  if (loadingMb || loadingAcc) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }
  if (!mailboxes.length) {
    return <span className="text-xs text-muted-foreground">Nessuna casella aziendale configurata</span>;
  }

  const toggle = (id: string, checked: boolean) => {
    const next = checked ? [...access, id] : access.filter((x) => x !== id);
    mutate.mutate(next);
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <span className="text-xs text-muted-foreground">Accesso a:</span>
      {mailboxes.filter((m) => m.is_active).map((m) => {
        const checked = access.includes(m.id);
        return (
          <label key={m.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox checked={checked} onCheckedChange={(v) => toggle(m.id, v === true)} />
            <span>{m.label}</span>
            {m.auto_grant && <span className="text-[10px] text-muted-foreground">(default)</span>}
          </label>
        );
      })}
    </div>
  );
}