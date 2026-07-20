// B2 — costruzione additiva dei campi canonici Message Intelligence v1
// per `reply_classifications`. Nessun side-effect, nessun import Deno-only:
// pensato per essere unit-testato in Vitest oltre che eseguito in Deno.
//
// Regole:
// - riusa `mapInboundToEmailCategory` esistente (nessuna logica duplicata);
// - campi non ancora disponibili nello stage 1 restano `null` — verranno
//   popolati da batch successivi (B3+) senza toccare questo modulo.

import { mapInboundToEmailCategory, type ClassificationValue } from "./types.ts";

export interface CanonicalExtension {
  category: string | null;
  sender_group_id: string | null;
  folder_hint: string | null;
  policy_plan: unknown[] | null;
  triage: Record<string, unknown> | null;
  canonical_version: number;
}

/**
 * Deriva i campi canonici dal solo dato disponibile nello stage 1.
 * - `category`: deterministico via `mapInboundToEmailCategory`.
 * - `sender_group_id`: sconosciuto qui → popolato da funnemail-auto-route (B3).
 * - `folder_hint`: sconosciuto qui → popolato da funnemail-classify (B3).
 * - `policy_plan`: sconosciuto qui → popolato da funnemail-policy-engine (B4).
 * - `triage`: sconosciuto qui → popolato da runTriageAndAlert stage 4 (B4).
 */
export function buildCanonicalExtension(input: {
  classification: ClassificationValue;
}): CanonicalExtension {
  return {
    category: mapInboundToEmailCategory(input.classification) ?? null,
    sender_group_id: null,
    folder_hint: null,
    policy_plan: null,
    triage: null,
    canonical_version: 1,
  };
}

/**
 * Feature flag server-side. Default sicuro: OFF quando la variabile è
 * assente o diversa dalla stringa esatta "true". Non esposta al frontend.
 */
export function isMessageIntelligenceV1Enabled(
  env: { get(name: string): string | undefined },
): boolean {
  return env.get("MESSAGE_INTELLIGENCE_V1_ENABLED") === "true";
}
