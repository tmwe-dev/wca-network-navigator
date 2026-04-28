/**
 * generate-email/operativePromptsLoader.ts — Thin re-export shim.
 *
 * The real implementation lives in `_shared/operativePromptsLoader.ts` so that
 * every AI edge function (generate-email, generate-outreach, improve-email,
 * classify-email-response, agent-loop, agent-execute, ai-assistant) shares the
 * same context+tag matching logic.
 *
 * Keeping this file as a re-export preserves the existing import path used by
 * `kbAndPlaybookAssembler.ts` so the email pipeline behaviour is unchanged.
 */
export {
  loadOperativePromptsBlock,
  type OperativePromptsResult,
} from "../_shared/operativePromptsLoader.ts";