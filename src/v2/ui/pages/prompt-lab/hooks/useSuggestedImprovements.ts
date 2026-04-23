/**
 * useSuggestedImprovements — Hook React per il ciclo di apprendimento.
 *
 * Espone:
 * - suggest(): crea un suggerimento (da chat o feedback)
 * - pending/approved lists con auto-refresh
 * - approve/reject/editAndApprove (admin)
 * - pendingCount per badge
 */
import { useCallback, useEffect, useState } from "react";
import {
  createSuggestion,
  listPendingForAdmin,
  listApprovedForArchitect,
  listUserPreferences,
  approveSuggestion,
  rejectSuggestion,
  editAndApprove,
  countByStatus,
  type CreateSuggestionInput,
  type SuggestedImprovement,
  type SuggestionStatus,
} from "@/data/suggestedImprovements";

export function useSuggestedImprovements(userId: string, isAdmin: boolean = false) {
  const [pending, setPending] = useState<SuggestedImprovement[]>([]);
  const [approved, setApproved] = useState<SuggestedImprovement[]>([]);
  const [preferences, setPreferences] = useState<SuggestedImprovement[]>([]);
  const [counts, setCounts] = useState<Record<SuggestionStatus, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [c, prefs] = await Promise.all([
        countByStatus(),
        listUserPreferences(userId),
      ]);
      setCounts(c);
      setPreferences(prefs);

      if (isAdmin) {
        const [p, a] = await Promise.all([
          listPendingForAdmin(),
          listApprovedForArchitect(),
        ]);
        setPending(p);
        setApproved(a);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Crea un suggerimento (da qualsiasi punto dell'app). */
  const suggest = useCallback(
    async (input: CreateSuggestionInput) => {
      const result = await createSuggestion(userId, input);
      await refresh();
      return result;
    },
    [userId, refresh],
  );

  /** Admin: approva. */
  const approve = useCallback(
    async (id: string, note?: string) => {
      await approveSuggestion(id, userId, note);
      await refresh();
    },
    [userId, refresh],
  );

  /** Admin: rifiuta. */
  const reject = useCallback(
    async (id: string, note?: string) => {
      await rejectSuggestion(id, userId, note);
      await refresh();
    },
    [userId, refresh],
  );

  /** Admin: modifica e approva. */
  const editApprove = useCallback(
    async (id: string, newContent: string, note?: string) => {
      await editAndApprove(id, userId, newContent, note);
      await refresh();
    },
    [userId, refresh],
  );

  return {
    pending,
    approved,
    preferences,
    counts,
    loading,
    suggest,
    approve,
    reject,
    editApprove,
    refresh,
  };
}
