import { useState, useCallback, useMemo } from "react";

/**
 * Generic selection hook used across ActivitiesTab, CampaignJobs, Campaigns.
 * Manages a Set<string> of selected IDs with toggle/selectAll/clear helpers.
 */
export function useSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const selectWhere = useCallback(
    (predicate: (item: T) => boolean) => {
      setSelectedIds(new Set(items.filter(predicate).map((i) => i.id)));
    },
    [items]
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /** Add a batch of IDs to the current selection (union) */
  const addBatch = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  /** Remove a batch of IDs from the current selection */
  const removeBatch = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const isAllSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items.length, selectedIds.size]
  );

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (checked) selectAll();
      else clear();
    },
    [selectAll, clear]
  );

  return {
    selectedIds,
    setSelectedIds,
    toggle,
    selectAll,
    selectWhere,
    clear,
    addBatch,
    removeBatch,
    isAllSelected,
    toggleAll,
    count: selectedIds.size,
  };
}
