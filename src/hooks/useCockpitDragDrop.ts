import { useState, useCallback, useMemo } from "react";

interface UseCockpitDragDropOptions {
  selectedIds: Set<string>;
  selectionCount: number;
}

export function useCockpitDragDrop({ selectedIds, selectionCount }: UseCockpitDragDropOptions) {
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => setDraggedContactId(id), []);
  const handleDragEnd = useCallback(() => setDraggedContactId(null), []);

  const getDraggedIds = useCallback((): string[] => {
    if (!draggedContactId) return [];
    if (selectedIds.has(draggedContactId) && selectionCount > 1) return Array.from(selectedIds);
    return [draggedContactId];
  }, [draggedContactId, selectedIds, selectionCount]);

  const dragCount = useMemo(() => {
    if (!draggedContactId) return 0;
    if (selectedIds.has(draggedContactId) && selectionCount > 1) return selectionCount;
    return 1;
  }, [draggedContactId, selectedIds, selectionCount]);

  return {
    draggedContactId, setDraggedContactId,
    dragCount,
    handleDragStart, handleDragEnd,
    getDraggedIds,
  };
}
