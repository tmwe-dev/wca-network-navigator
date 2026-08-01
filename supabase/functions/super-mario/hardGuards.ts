/**
 * hardGuards.ts — Vincoli tecnici INVIOLABILI applicati dal codice.
 * Sono safety nets indipendenti dall'LLM. Se la risposta li viola, viene scartata.
 */

import type { SuperMarioResponse } from "./runtimeContract.ts";
import type { ToolDescriptor } from "./toolCatalog.ts";

export interface GuardViolation {
  code: string;
  message: string;
  severity: "block" | "warn";
}

const FORBIDDEN_TOOL_PATTERNS = [/delete/i, /drop/i, /truncate/i, /purge/i];
const MAX_TOOL_CALLS_PER_TURN = 5;

export function applyHardGuards(
  response: SuperMarioResponse,
  catalog: ToolDescriptor[],
): { ok: boolean; violations: GuardViolation[]; sanitized: SuperMarioResponse } {
  const violations: GuardViolation[] = [];
  const sanitized: SuperMarioResponse = {
    message: response.message ?? "",
    tool_calls: Array.isArray(response.tool_calls) ? [...response.tool_calls] : [],
    reasoning_summary: response.reasoning_summary ?? "",
    needs_user_confirmation: !!response.needs_user_confirmation,
    warnings: Array.isArray(response.warnings) ? [...response.warnings] : [],
  };

  // Cap tool_calls
  if (sanitized.tool_calls.length > MAX_TOOL_CALLS_PER_TURN) {
    violations.push({
      code: "too_many_tool_calls",
      message: `Tagliato a ${MAX_TOOL_CALLS_PER_TURN} (richiesti ${sanitized.tool_calls.length}).`,
      severity: "warn",
    });
    sanitized.tool_calls = sanitized.tool_calls.slice(0, MAX_TOOL_CALLS_PER_TURN);
  }

  // Filtro tool inesistenti / vietati / forza confirmation per write+
  const validated: typeof sanitized.tool_calls = [];
  for (const call of sanitized.tool_calls) {
    const name = String(call.tool_name ?? "");
    if (FORBIDDEN_TOOL_PATTERNS.some((re) => re.test(name))) {
      violations.push({
        code: "forbidden_tool",
        message: `Tool "${name}" rifiutato (pattern destructive).`,
        severity: "block",
      });
      continue;
    }
    const descriptor = catalog.find((t) => t.name === name);
    if (!descriptor) {
      violations.push({
        code: "unknown_tool",
        message: `Tool "${name}" non esiste nel catalog.`,
        severity: "block",
      });
      continue;
    }
    if (descriptor.risk_level === "destructive") {
      violations.push({
        code: "destructive_blocked",
        message: `Tool "${name}" e' destructive: bloccato.`,
        severity: "block",
      });
      continue;
    }
    if (descriptor.risk_level !== "read" && !sanitized.needs_user_confirmation) {
      sanitized.needs_user_confirmation = true;
      violations.push({
        code: "auto_set_confirmation",
        message: `Forzato needs_user_confirmation=true per tool "${name}" (risk=${descriptor.risk_level}).`,
        severity: "warn",
      });
    }
    validated.push(call);
  }
  sanitized.tool_calls = validated;

  const blocking = violations.filter((v) => v.severity === "block");
  return { ok: blocking.length === 0, violations, sanitized };
}
