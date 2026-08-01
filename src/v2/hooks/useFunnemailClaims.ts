/**
 * useFunnemailClaims — query + realtime subscription per i claim "Lo prendo io".
 *
 * Visibilità globale: tutti gli operatori vedono lo stesso badge.
 * Realtime: aggiornamento automatico via canale postgres_changes.
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/AuthProvider";
import {
  listActiveFunnemailClaims,
  claimFunnemailMessage,
  releaseFunnemailMessage,
  forceClaimFunnemailMessage,
  type FunnemailClaimWithOperator,
} from "@/data/funnemailClaims";

export interface UseFunnemailClaimsResult {
  claimsByMessageId: Map<string, FunnemailClaimWithOperator>;
  isLoading: boolean;
  claim: (args: { messageId: string; groupId?: string | null }) => Promise<void>;
  release: (messageId: string) => Promise<void>;
  forceClaim: (args: { messageId: string; groupId?: string | null }) => Promise<void>;
  myUserId: string | null;
  pendingMessageId: string | null;
}

export function useFunnemailClaims(groupId?: string | null): UseFunnemailClaimsResult {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [pendingMessageId, setPendingMessageId] = React.useState<string | null>(null);

  const queryKey = queryKeys.funnemailInbox.claims.byGroup(groupId ?? null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listActiveFunnemailClaims(groupId ?? null),
    staleTime: 15_000,
  });

  // Realtime sub
  React.useEffect(() => {
    const channel = supabase
      .channel(`funnemail-claims-${groupId ?? "all"}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "funnemail_message_claims" },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.claims.active() });
          qc.invalidateQueries({ queryKey });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc, queryKey]);

  const map = React.useMemo(() => {
    const m = new Map<string, FunnemailClaimWithOperator>();
    for (const c of data ?? []) m.set(c.message_id, c);
    return m;
  }, [data]);

  const invalidate = React.useCallback(() => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.claims.active() });
  }, [qc, queryKey]);

  const claimMut = useMutation({
    mutationFn: claimFunnemailMessage,
    onSuccess: (res, vars) => {
      if (!res.ok && res.conflict) {
        toast.error(`Già presa in carico da un altro operatore`);
      } else {
        toast.success("Messaggio preso in carico");
      }
      invalidate();
      void vars;
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Errore sul claim";
      toast.error(msg);
    },
  });

  const releaseMut = useMutation({
    mutationFn: releaseFunnemailMessage,
    onSuccess: () => {
      toast.success("Messaggio rilasciato");
      invalidate();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Errore sul rilascio");
    },
  });

  const forceMut = useMutation({
    mutationFn: forceClaimFunnemailMessage,
    onSuccess: () => {
      toast.success("Presa in carico forzata");
      invalidate();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Errore force-claim (solo admin)");
    },
  });

  const claim = React.useCallback(
    async (args: { messageId: string; groupId?: string | null }) => {
      setPendingMessageId(args.messageId);
      try {
        await claimMut.mutateAsync(args);
      } finally {
        setPendingMessageId(null);
      }
    },
    [claimMut],
  );

  const release = React.useCallback(
    async (messageId: string) => {
      setPendingMessageId(messageId);
      try {
        await releaseMut.mutateAsync(messageId);
      } finally {
        setPendingMessageId(null);
      }
    },
    [releaseMut],
  );

  const forceClaim = React.useCallback(
    async (args: { messageId: string; groupId?: string | null }) => {
      setPendingMessageId(args.messageId);
      try {
        await forceMut.mutateAsync(args);
      } finally {
        setPendingMessageId(null);
      }
    },
    [forceMut],
  );

  return {
    claimsByMessageId: map,
    isLoading,
    claim,
    release,
    forceClaim,
    myUserId: user?.id ?? null,
    pendingMessageId,
  };
}