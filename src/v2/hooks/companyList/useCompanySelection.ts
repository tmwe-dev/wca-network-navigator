/**
 * useCompanySelection — Set<id> selezione multipla per CompanyCardList.
 * UI logic-less: la lista passa selectedIds + onToggle, qui sta lo stato.
 */
import { useCallback, useState } from "react";

export interface UseCompanySelectionResult {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  count: number;
}

export function useCompanySelection(): UseCompanySelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      // Se già tutti selezionati → svuota; altrimenti aggiungi tutti.
      const allIn = ids.every((i) => prev.has(i));
      if (allIn && ids.length > 0) return new Set();
      const next = new Set(prev);
      for (const i of ids) next.add(i);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    clear,
    count: selectedIds.size,
  };
}