/**
 * postflightAudit.ts — Valida la risposta DOPO il modello, prima di tornare al client.
 * Lavora insieme a hardGuards (che modifica) e a runtimeContract.isSuperMarioResponse (shape).
 */

import { isSuperMarioResponse, type SuperMarioResponse } from "./runtimeContract.ts";

export interface PostflightResult {
  ok: boolean;
  reason?: string;
  parsed?: SuperMarioResponse;
}

export function postflightAudit(rawText: string): PostflightResult {
  let cleaned = rawText.trim();
  // Strip eventuali fence ```json ... ```
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, reason: `invalid_json: ${(e as Error).message}` };
  }
  if (!isSuperMarioResponse(parsed)) {
    return { ok: false, reason: "schema_mismatch" };
  }
  return { ok: true, parsed };
}
