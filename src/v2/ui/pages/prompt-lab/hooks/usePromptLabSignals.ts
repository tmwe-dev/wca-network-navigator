/**
 * usePromptLabSignals — hook per il feedback loop automatico.
 *
 * LOVABLE-92: Analizza log e genera segnalazioni per il Prompt Lab.
 * L'operatore vede un badge con il numero di segnalazioni e può
 * espandere la lista per vedere dettagli e suggerimenti.
 */
import { useCallback, useEffect, useState } from "react";
import {
  analyzeAndGenerateSignals,
  getRecentSignalCount,
  type PromptLabSignal,
} from "@/data/promptLabSignals";

export interface SignalsState {
  loading: boolean;
  signals: PromptLabSignal[];
  badgeCount: number;
}

export function usePromptLabSignals(userId: string) {
  const [state, setState] = useState<SignalsState>({
    loading: false,
    signals: [],
    badgeCount: 0,
  });

  // Check badge count on mount (lightweight)
  useEffect(() => {
    if (!userId) return;
    getRecentSignalCount(userId).then((count) => {
      setState((s) => ({ ...s, badgeCount: count }));
    }).catch(() => {});
  }, [userId]);

  // Full analysis (heavier — called on demand)
  const analyze = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const signals = await analyzeAndGenerateSignals(userId);
      setState({ loading: false, signals, badgeCount: signals.length });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [userId]);

  const dismiss = useCallback((signalId: string) => {
    setState((s) => ({
      ...s,
      signals: s.signals.map((sig) =>
        sig.id === signalId ? { ...sig, status: "dismissed" as const } : sig,
      ),
    }));
  }, []);

  const acknowledge = useCallback((signalId: string) => {
    setState((s) => ({
      ...s,
      signals: s.signals.map((sig) =>
        sig.id === signalId ? { ...sig, status: "acknowledged" as const } : sig,
      ),
    }));
  }, []);

  return { state, analyze, dismiss, acknowledge };
}
