/**
 * useAiInteractionLogger — hook wrapper su logAiInteraction (DAL).
 *
 * I componenti non importano direttamente da src/data/: questo hook espone
 * la funzione di logging delle interazioni AI per l'uso lato UI.
 */
import { useMemo } from "react";
import {
  logAiInteraction,
  type AiInteractionLogInput,
} from "@/data/aiInteractionLog";

export function useAiInteractionLogger() {
  return useMemo(
    () => ({
      logAiInteraction: (input: AiInteractionLogInput): Promise<string | null> =>
        logAiInteraction(input),
    }),
    [],
  );
}
