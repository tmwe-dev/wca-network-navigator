/**
 * useFunnemailStatuses — query + realtime subscription per gli stati job.
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  listStatusesForGroup,
  setMessageStatus,
  type FunnemailJobStatus,
  type FunnemailStatusRow,
  FUNNEMAIL_JOB_STATUS_LABELS,
} from "@/data/funnemailStatuses";

export interface UseFunnemailStatusesResult {
  statusesByMessageId: Map<string, FunnemailStatusRow>;
  isLoading: boolean;
  setStatus: (args: {
    messageId: string;
    groupId?: string | null;
    status: FunnemailJobStatus;
    reason?: string | null;
  }) => Promise<void>;
  pendingMessageId: string | null;
}

export function useFunnemailStatuses(groupId?: string | null): UseFunnemailStatusesResult {
  const qc = useQueryClient();
  const [pendingMessageId, setPendingMessageId] = React.useState<string | null>(null);
  const queryKey = queryKeys.funnemailInbox.statuses.byGroup(groupId ?? null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listStatusesForGroup(groupId ?? null),
    staleTime: 15_000,
  });

  React.useEffect(() => {
    const channel = supabase
      .channel(`funnemail-statuses-${groupId ?? "all"}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "funnemail_message_status" },
        () => {
          qc.invalidateQueries({ queryKey });
          qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.sorting.queue() });
          qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.sorting.count() });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc, queryKey]);

  const map = React.useMemo(() => {
    const m = new Map<string, FunnemailStatusRow>();
    for (const r of data ?? []) m.set(r.message_id, r);
    return m;
  }, [data]);

  const mut = useMutation({
    mutationFn: setMessageStatus,
    onSuccess: (_res, vars) => {
      toast.success(`Stato aggiornato: ${FUNNEMAIL_JOB_STATUS_LABELS[vars.status]}`);
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.sorting.queue() });
      qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.sorting.count() });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Errore aggiornamento stato");
    },
  });

  const setStatus = React.useCallback(
    async (args: {
      messageId: string;
      groupId?: string | null;
      status: FunnemailJobStatus;
      reason?: string | null;
    }) => {
      setPendingMessageId(args.messageId);
      try {
        await mut.mutateAsync(args);
      } finally {
        setPendingMessageId(null);
      }
    },
    [mut],
  );

  return { statusesByMessageId: map, isLoading, setStatus, pendingMessageId };
}