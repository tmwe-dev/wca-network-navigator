/**
 * useCestinone — hook unificato per la coda pre-invio.
 */
import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCestinone, cancelCestinoItem, snoozeCestinoItem, type CestinoItem, type CestinoChannel, type CestinoStatus } from "@/data/cestinone";
import { queryKeys } from "@/lib/queryKeys";

export interface CestinoFilters {
  readonly channel?: CestinoChannel | "all";
  readonly status?: CestinoStatus | "all";
  readonly search?: string;
}

export function useCestinone(filters: CestinoFilters = {}) {
  const qc = useQueryClient();
  // ID locali "nascosti" subito dopo conferma/annullamento, per
  // dare feedback istantaneo prima del refetch.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const query = useQuery({
    queryKey: queryKeys.cestinone.list(filters),
    queryFn: fetchCestinone,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const items = useMemo(() => {
    const all = query.data ?? [];
    return all.filter((it) => {
      if (dismissed.has(it.id)) return false;
      if (filters.channel && filters.channel !== "all" && it.channel !== filters.channel) return false;
      if (filters.status && filters.status !== "all" && it.status !== filters.status) return false;
      if (filters.search && filters.search.trim()) {
        const s = filters.search.toLowerCase();
        const hay = `${it.subject ?? ""} ${it.recipientName ?? ""} ${it.recipientHandle ?? ""} ${it.preview ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [query.data, dismissed, filters.channel, filters.status, filters.search]);

  const counts = useMemo(() => {
    const all = query.data ?? [];
    return {
      total: all.length,
      byChannel: {
        email: all.filter((i) => i.channel === "email").length,
        whatsapp: all.filter((i) => i.channel === "whatsapp").length,
        linkedin: all.filter((i) => i.channel === "linkedin").length,
      },
      byStatus: {
        pending: all.filter((i) => i.status === "pending").length,
        scheduled: all.filter((i) => i.status === "scheduled").length,
        queued: all.filter((i) => i.status === "queued").length,
        blocked: all.filter((i) => i.status === "blocked").length,
      },
    };
  }, [query.data]);

  const cancel = useMutation({
    mutationFn: cancelCestinoItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cestinone.all }),
  });

  const snooze = useMutation({
    mutationFn: ({ item, minutes }: { item: CestinoItem; minutes?: number }) =>
      snoozeCestinoItem(item, minutes ?? 60),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cestinone.all }),
  });

  return { ...query, items, counts, cancel, snooze, dismiss };
}