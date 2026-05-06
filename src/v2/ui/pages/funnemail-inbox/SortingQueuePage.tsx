/**
 * SortingQueuePage — coda dei messaggi marcati `da_smistare`.
 * Logic-less: dati dalla view `funnemail_sorting_queue` via DAL.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Inbox } from "lucide-react";
import { listSortingQueue, FUNNEMAIL_JOB_STATUS_LABELS } from "@/data/funnemailStatuses";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { useFunnemailStatuses } from "@/v2/hooks/useFunnemailStatuses";

export function SortingQueuePage(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.funnemailInbox.sorting.queue(),
    queryFn: listSortingQueue,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const statusesCtl = useFunnemailStatuses(null);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/v2/funnemail-inbox"><ArrowLeft className="h-4 w-4" /> Inbox</Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Sorting</h1>
            <p className="text-xs text-muted-foreground">Messaggi da smistare manualmente</p>
          </div>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          {data?.length ?? 0} in coda
        </span>
      </header>
      <div className="flex-1 overflow-auto p-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carico…</p>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-50" />
            Nessun messaggio in attesa di smistamento.
          </div>
        )}
        <ul className="space-y-2">
          {(data ?? []).map((row) => (
            <li
              key={row.message_id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-muted-foreground">{row.message_id}</p>
                <p className="text-xs text-muted-foreground">
                  {FUNNEMAIL_JOB_STATUS_LABELS[row.status]}
                  {row.status_reason ? ` · ${row.status_reason}` : ""}
                  {" · "}
                  {new Date(row.changed_at).toLocaleString("it-IT")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void statusesCtl.setStatus({
                      messageId: row.message_id,
                      groupId: row.group_id,
                      status: "risolto",
                    })
                  }
                >
                  Risolto
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void statusesCtl.setStatus({
                      messageId: row.message_id,
                      groupId: row.group_id,
                      status: "archiviato",
                    })
                  }
                >
                  Archivia
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}