/**
 * useFunnemailReminders — query + realtime subscription per i reminder/snooze.
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  listActiveReminders,
  createReminder,
  dismissReminder,
  type FunnemailReminderRow,
} from "@/data/funnemailReminders";

export interface UseFunnemailRemindersResult {
  remindersByMessageId: Map<string, FunnemailReminderRow>;
  isLoading: boolean;
  create: (args: {
    messageId: string;
    groupId?: string | null;
    remindAt: Date;
    note?: string | null;
  }) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export function useFunnemailReminders(groupId?: string | null): UseFunnemailRemindersResult {
  const qc = useQueryClient();
  const queryKey = queryKeys.funnemailInbox.reminders.byGroup(groupId ?? null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listActiveReminders(groupId ?? null),
    staleTime: 30_000,
  });

  React.useEffect(() => {
    const channel = supabase
      .channel(`funnemail-reminders-${groupId ?? "all"}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "funnemail_message_reminders" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc, queryKey]);

  const map = React.useMemo(() => {
    const m = new Map<string, FunnemailReminderRow>();
    for (const r of data ?? []) {
      // Solo reminder ancora "futuri" (non triggerati) finiscono nella card
      if (!r.triggered_at) m.set(r.message_id, r);
    }
    return m;
  }, [data]);

  const createMut = useMutation({
    mutationFn: createReminder,
    onSuccess: () => {
      toast.success("Reminder impostato");
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Errore reminder"),
  });

  const dismissMut = useMutation({
    mutationFn: dismissReminder,
    onSuccess: () => {
      toast.success("Reminder rimosso");
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Errore rimozione"),
  });

  return {
    remindersByMessageId: map,
    isLoading,
    create: (args) => createMut.mutateAsync(args).then(() => undefined),
    dismiss: (id) => dismissMut.mutateAsync(id).then(() => undefined),
  };
}