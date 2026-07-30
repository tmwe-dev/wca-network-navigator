/**
 * useAiExportBundle — wrapper hook sul DAL `src/data/aiExport.ts`.
 * Mantiene il layering: i componenti non importano il DAL direttamente.
 */
import { useCallback } from "react";
import { fetchAiExportBundle } from "@/data/aiExport";

export function useAiExportBundle() {
  return useCallback((userId: string) => fetchAiExportBundle(userId), []);
}
