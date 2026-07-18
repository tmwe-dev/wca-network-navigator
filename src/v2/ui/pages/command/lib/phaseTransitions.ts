/**
 * phaseTransitions — helper unico per le transizioni UI del Command flow.
 *
 * Elimina la ripetizione di 5-6 setter combinati sparsi in useCommandSubmit,
 * runDirectComposer, fallback ai-query. Un solo posto per garantire coerenza
 * tra flowPhase / showTools / toolPhase / chainHighlight.
 *
 * Fase → semantica:
 *   idle       → nessuna operazione in corso
 *   thinking   → planner in esecuzione (chain 0→2)
 *   executing  → planRunner in esecuzione (chain 3→5)
 *   done       → operazione completata (chain 5)
 */
import type { FlowPhase } from "../constants";

export interface PhaseApi {
  setFlowPhase: (p: FlowPhase) => void;
  setShowTools: (v: boolean) => void;
  setToolPhase: (v: "activating" | "active" | "done") => void;
  setChainHighlight: (v: number | undefined | ((prev: number | undefined) => number | undefined)) => void;
}

export function enterIdle(api: PhaseApi): void {
  api.setFlowPhase("idle");
  api.setShowTools(false);
}

export function enterThinking(api: PhaseApi): void {
  api.setFlowPhase("thinking");
  api.setShowTools(true);
  api.setToolPhase("activating");
  api.setChainHighlight(0);
}

export function enterExecuting(api: PhaseApi): void {
  api.setFlowPhase("executing");
  api.setToolPhase("active");
  api.setChainHighlight(5);
}

/**
 * Animazione della "chain" durante il planning: avanza 0→2 con intervallo.
 * Ritorna il cleanup (clearInterval) da chiamare alla fine del planning.
 */
export function startChainAnimation(
  setChainHighlight: PhaseApi["setChainHighlight"],
  stepMs = 600,
): () => void {
  const id = setInterval(() => {
    setChainHighlight((prev) => {
      if (prev === undefined || prev >= 2) return prev;
      return prev + 1;
    });
  }, stepMs);
  return () => clearInterval(id);
}