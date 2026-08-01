/**
 * preflightAudit.ts — Verifica il prompt PRIMA di chiamare l'LLM.
 * Blocca se: prompt vuoto, troppo lungo, o contiene pattern injection ovvi.
 */

const MAX_PROMPT_CHARS = 80_000;
const INJECTION_PATTERNS = [
  /ignore (all|previous) instructions/i,
  /system prompt[:\s]+you are/i,
  /<\|im_start\|>/i,
];

export interface PreflightResult {
  ok: boolean;
  reason?: string;
  size_chars: number;
  warnings: string[];
}

export function preflightAudit(systemPrompt: string, userMessage: string): PreflightResult {
  const total = systemPrompt.length + userMessage.length;
  const warnings: string[] = [];

  if (!userMessage || userMessage.trim().length === 0) {
    return { ok: false, reason: "empty_user_message", size_chars: total, warnings };
  }
  if (total > MAX_PROMPT_CHARS) {
    return { ok: false, reason: `prompt_too_large (${total} > ${MAX_PROMPT_CHARS})`, size_chars: total, warnings };
  }
  for (const re of INJECTION_PATTERNS) {
    if (re.test(userMessage)) {
      warnings.push(`injection_pattern_detected:${re.source}`);
    }
  }
  return { ok: true, size_chars: total, warnings };
}
