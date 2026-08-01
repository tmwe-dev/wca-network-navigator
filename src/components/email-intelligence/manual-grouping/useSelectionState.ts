/**
 * useSelectionState — Multi-select state and bulk selection logic.
 */
import { useState, useCallback } from "react";
import type { SenderAnalysis } from "@/types/email-management";

export function useSelectionState() {
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set());

  const toggleSenderSelection = useCallback((email: string) => {
    setSelectedSenders((prev) => {
      const updated = new Set(prev);
      if (updated.has(email)) {
        updated.delete(email);
      } else {
        updated.add(email);
      }
      return updated;
    });
  }, []);

  const selectAll = useCallback((visibleSenders: SenderAnalysis[]) => {
    setSelectedSenders((prev) => {
      if (prev.size === visibleSenders.length && prev.size > 0) {
        // Deselect all
        return new Set();
      } else {
        // Select all visible
        return new Set(visibleSenders.map((s) => s.email));
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSenders(new Set());
  }, []);

  const getSelectedSenderObjects = useCallback(
    (allSenders: SenderAnalysis[]): SenderAnalysis[] => {
      return Array.from(selectedSenders)
        .map((email) => allSenders.find((s) => s.email === email))
        .filter((s): s is SenderAnalysis => s !== undefined);
    },
    [selectedSenders],
  );

  return {
    selectedSenders,
    setSelectedSenders,
    toggleSenderSelection,
    selectAll,
    clearSelection,
    getSelectedSenderObjects,
  };
}
