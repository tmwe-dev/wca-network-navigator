/**
 * useAiTestHub — state + business logic per AI Test Hub.
 */
import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listScenarios, upsertScenario, deleteScenario, runScenarios,
  type AiTestScenario, type AiTestRunResult,
} from "@/data/aiTestScenarios";

const QK = ["v2", "ai-test-hub", "scenarios"] as const;

export function useAiTestHub() {
  const qc = useQueryClient();
  const scenariosQ = useQuery({ queryKey: QK, queryFn: listScenarios, staleTime: 30_000 });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, AiTestRunResult>>({});
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState<Partial<AiTestScenario> | null>(null);

  const toggle = useCallback((id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const runMut = useMutation({
    mutationFn: async (ids: string[]) => runScenarios(ids),
    onMutate: () => setRunning(true),
    onSuccess: (data) => {
      const map: Record<string, AiTestRunResult> = { ...results };
      for (const r of data.results) map[r.scenario_id] = r;
      setResults(map);
      toast.success(`${data.passed}/${data.total} test passati`);
    },
    onError: (e: Error) => toast.error(`Errore esecuzione: ${e.message}`),
    onSettled: () => setRunning(false),
  });

  const runSelected = useCallback(() => {
    if (selectedIds.size === 0) { toast.info("Seleziona almeno uno scenario"); return; }
    runMut.mutate(Array.from(selectedIds));
  }, [selectedIds, runMut]);

  const runAll = useCallback(() => {
    const ids = (scenariosQ.data ?? []).map((s) => s.id);
    if (ids.length === 0) return;
    runMut.mutate(ids);
  }, [scenariosQ.data, runMut]);

  const saveMut = useMutation({
    mutationFn: (input: Partial<AiTestScenario>) => upsertScenario(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      setEditing(null);
      toast.success("Scenario salvato");
    },
    onError: (e: Error) => toast.error(`Errore salvataggio: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteScenario(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Eliminato"); },
    onError: (e: Error) => toast.error(`Errore: ${e.message}`),
  });

  return {
    scenarios: scenariosQ.data ?? [],
    isLoading: scenariosQ.isLoading,
    selectedIds, toggle, selectAll, clearSelection,
    results, running,
    runSelected, runAll,
    editing, setEditing,
    save: saveMut.mutate, isSaving: saveMut.isPending,
    remove: deleteMut.mutate,
  };
}