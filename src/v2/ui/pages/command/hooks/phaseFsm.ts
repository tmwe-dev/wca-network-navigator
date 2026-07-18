/**
 * phaseFsm — reducer + invariants per la "phase quintet" del Command.
 *
 * Sostituisce 5 useState indipendenti con un unico reducer che garantisce
 * coerenza tra flowPhase / showTools / toolPhase / chainHighlight / activeToolKey.
 *
 * L'API pubblica di useCommandState resta invariata: gli setter espongono
 * ciascun campo, ma internamente attraversano il reducer così ogni transizione
 * è tracciabile e non può produrre stati incoerenti (es. flowPhase=executing
 * con showTools=false).
 */
import type { FlowPhase, ToolPhase } from "../constants";

export interface PhaseState {
  flowPhase: FlowPhase;
  showTools: boolean;
  toolPhase: ToolPhase;
  chainHighlight: number | undefined;
  activeToolKey: string | null;
}

export const INITIAL_PHASE: PhaseState = {
  flowPhase: "idle",
  showTools: false,
  toolPhase: "active",
  chainHighlight: undefined,
  activeToolKey: null,
};

export type PhaseAction =
  | { type: "SET_FLOW"; value: FlowPhase }
  | { type: "SET_SHOW_TOOLS"; value: boolean }
  | { type: "SET_TOOL_PHASE"; value: ToolPhase }
  | { type: "SET_CHAIN"; value: number | undefined }
  | { type: "SET_ACTIVE_TOOL"; value: string | null }
  | { type: "RESET" };

/**
 * Invarianti applicate a ogni transizione:
 *  - flowPhase="idle"      → showTools=false, chainHighlight=undefined
 *  - flowPhase="executing" → showTools=true, toolPhase="active"
 *  - flowPhase="thinking"  → showTools=true
 */
function normalize(s: PhaseState): PhaseState {
  if (s.flowPhase === "idle") {
    return { ...s, showTools: false, chainHighlight: undefined };
  }
  if (s.flowPhase === "thinking") {
    return { ...s, showTools: true };
  }
  if (s.flowPhase === "executing") {
    return { ...s, showTools: true, toolPhase: "active" };
  }
  return s;
}

export function phaseReducer(state: PhaseState, action: PhaseAction): PhaseState {
  switch (action.type) {
    case "SET_FLOW":
      return normalize({ ...state, flowPhase: action.value });
    case "SET_SHOW_TOOLS":
      return normalize({ ...state, showTools: action.value });
    case "SET_TOOL_PHASE":
      return normalize({ ...state, toolPhase: action.value });
    case "SET_CHAIN":
      return normalize({ ...state, chainHighlight: action.value });
    case "SET_ACTIVE_TOOL":
      return normalize({ ...state, activeToolKey: action.value });
    case "RESET":
      return INITIAL_PHASE;
    default:
      return state;
  }
}