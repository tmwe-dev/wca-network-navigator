/**
 * intentClassifier — unico punto di classificazione dell'intento in Command.
 *
 * Sostituisce i 3 rami di ingresso sparsi in `useCommandSubmit.sendMessage`:
 *   1. smalltalk short-circuit (saluti, presenza, ack, farewell, status)
 *   2. fast-lane compose-email (batch email quando c'è selezione partner)
 *   3. default: passa al planner (planExecution → planRunner)
 *
 * Non introduce nuove regole: riusa `detectSmalltalk` e il `match()` del tool
 * compose-email presente in `TOOLS`. Il comportamento è identico a prima,
 * ma centralizzato per rendere il master control leggibile e testabile.
 */
import { detectSmalltalk, type SmalltalkMatch } from "./smalltalkDetector";
import { TOOLS } from "../tools/registry";
import type { Tool } from "../tools/types";

export type Intent =
  | { kind: "smalltalk"; match: SmalltalkMatch }
  | { kind: "compose-email"; tool: Tool }
  | { kind: "plan" };

/**
 * Classifica il prompt grezzo dell'utente in uno dei 3 rami operativi.
 * L'ordine di valutazione è significativo:
 *   smalltalk > compose-email > plan (default)
 */
export function classifyIntent(rawText: string): Intent {
  const small = detectSmalltalk(rawText);
  if (small) return { kind: "smalltalk", match: small };

  const composer = TOOLS.find((t) => t.id === "compose-email");
  if (composer?.match(rawText)) {
    return { kind: "compose-email", tool: composer };
  }

  return { kind: "plan" };
}
