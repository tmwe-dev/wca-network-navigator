/**
 * postGenerationReview — Pipeline post-generazione condivisa.
 *
 * Wrapper unico attorno al Giornalista AI (caporedattore finale) e al
 * contratto/detector email, in modo che TUTTE le superfici che generano
 * messaggi (generate-email, generate-outreach, agent-execute, cadence-engine)
 * applichino le stesse fasi finali del processo:
 *
 *   - costruzione + validazione `EmailContract` (solo canale email con partner)
 *   - `detectEmailType` per intercettare conflitti tipo/storia/stato
 *   - `journalistReview` come caporedattore finale (edits + verdetto)
 *
 * NB: questo modulo non duplica logica — riusa i moduli `_shared/*` già
 * esistenti. Serve solo a uniformare l'integrazione.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  buildEmailContract,
  validateEmailContract,
  type EmailContract,
  type ResolvedEmailType,
} from "./emailContract.ts";
import { detectEmailType } from "./emailTypeDetector.ts";
import { journalistReview } from "./journalistReviewLayer.ts";
import { loadOptimusSettings } from "./journalistSelector.ts";
import type {
  JournalistReviewOutput,
  ReviewChannel,
} from "./journalistTypes.ts";

export type PipelineChannel = ReviewChannel; // "email" | "whatsapp" | "linkedin" | "voice_script"

export interface RunEmailContractArgs {
  engine: "generate-email" | "improve-email" | "agent-execute" | "command";
  operation: "generate" | "improve" | "review";
  partnerId: string;
  contactId?: string | null;
  emailType: string;
  emailDescription: string;
  objective?: string;
  language?: string;
  fallbackPartnerName?: string;
  fallbackContactEmail?: string;
}

export interface RunEmailContractResult {
  contract: EmailContract | null;
  typeResolution: ResolvedEmailType | null;
  buildWarnings: string[];
  validationWarnings: string[];
  blocking: boolean;
  blockingResponse?: { status: number; body: Record<string, unknown> };
}

/**
 * Costruisce contratto + detector. Se la validazione fallisce o il detector
 * rileva un conflitto bloccante, ritorna `blocking=true` con il payload da
 * restituire al chiamante (status 422 + body strutturato).
 * In caso di errore non-fatale (try/catch interno), ritorna `contract=null`
 * e `blocking=false` per non interrompere la generazione.
 */
export async function runEmailContract(
  supabase: any,
  userId: string,
  args: RunEmailContractArgs,
): Promise<RunEmailContractResult> {
  const result: RunEmailContractResult = {
    contract: null,
    typeResolution: null,
    buildWarnings: [],
    validationWarnings: [],
    blocking: false,
  };

  try {
    const { contract, build_warnings } = await buildEmailContract(supabase, userId, {
      engine: args.engine,
      operation: args.operation,
      partnerId: args.partnerId,
      contactId: args.contactId ?? null,
      emailType: args.emailType || "primo_contatto",
      emailDescription: args.emailDescription || "",
      objective: args.objective,
      language: args.language,
      fallbackPartnerName: args.fallbackPartnerName,
      fallbackContactEmail: args.fallbackContactEmail,
    });
    result.contract = contract;
    result.buildWarnings = build_warnings;

    const validation = validateEmailContract(contract);
    result.validationWarnings = validation.warnings;
    if (!validation.valid) {
      result.blocking = true;
      result.blockingResponse = {
        status: 422,
        body: {
          success: false,
          error: "CONTRACT_INVALID",
          errors: validation.errors,
          warnings: validation.warnings,
        },
      };
      return result;
    }

    const typeResolution = detectEmailType(contract);
    result.typeResolution = typeResolution;
    if (!typeResolution.proceed) {
      result.blocking = true;
      result.blockingResponse = {
        status: 422,
        body: {
          success: false,
          error: "TYPE_CONFLICT",
          type_resolution: typeResolution,
          message: `Tipo "${typeResolution.original_type}" non coerente con stato/history. ${typeResolution.conflicts
            .filter((c) => c.severity === "blocking")
            .map((c) => c.suggestion)
            .join(". ")}`,
        },
      };
    }
  } catch (e) {
    console.warn(
      "[postGenerationReview] runEmailContract failed (non-blocking):",
      e instanceof Error ? e.message : e,
    );
  }
  return result;
}

export interface RunJournalistReviewArgs {
  channel: PipelineChannel;
  draft: string;
  emailType?: string | null;
  objective?: string | null;
  playbookActive?: boolean;
  partner: {
    id: string | null;
    company_name?: string | null;
    country?: string | null;
  };
  contact?: { name?: string | null; role?: string | null } | null;
  commercialState: {
    leadStatus?: string | null;
    touchCount?: number;
    lastOutcome?: string | null;
    daysSinceLastInbound?: number | null;
    hasActiveConversation?: boolean;
  };
  historySummary?: string | null;
  kbSummary?: string | null;
  isReply?: boolean;
  originalInbound?: {
    subject?: string;
    summary?: string;
    classification?: string;
  };
  /** Override strictness manuale (1-10). Se assente, usa quello globale. */
  strictnessOverride?: number;
}

export interface RunJournalistReviewResult {
  review: JournalistReviewOutput | null;
  /** Testo finale: edited_text se pass_with_edits, draft originale altrimenti */
  finalText: string;
  enabled: boolean;
}

/**
 * Applica il giornalista AI. No-op se Optimus è disabilitato globalmente o
 * se la draft è vuota. Per canali != email, riduce automaticamente la
 * strictness di 2 punti (cap 1-10) per rispettare la natura più informale
 * di WhatsApp/LinkedIn.
 */
export async function runJournalistReview(
  supabase: any,
  userId: string,
  args: RunJournalistReviewArgs,
): Promise<RunJournalistReviewResult> {
  const fallback: RunJournalistReviewResult = {
    review: null,
    finalText: args.draft,
    enabled: false,
  };

  if (!args.draft || args.draft.trim().length === 0) return fallback;

  let optimus: { enabled: boolean; mode: "review_and_correct" | "review_only" | "silent_audit"; strictness: number };
  try {
    optimus = await loadOptimusSettings(supabase, userId);
  } catch {
    return fallback;
  }
  if (!optimus.enabled) return fallback;

  // Per canali non-email abbassiamo la strictness: il Giornalista è tarato
  // su email B2B; su WA/LI deve solo evitare violazioni grossolane (HTML,
  // limite caratteri, tono inadatto) senza sovraccorreggere uno stile
  // colloquiale legittimo.
  const baseStrict = args.strictnessOverride ?? optimus.strictness;
  const strictness = args.channel === "email"
    ? baseStrict
    : Math.max(1, Math.min(10, baseStrict - 2));

  try {
    const review = await journalistReview(supabase, userId, {
      final_draft: args.draft,
      resolved_brief: {
        email_type: args.emailType ?? undefined,
        objective: args.objective ?? undefined,
        playbook_active: args.playbookActive ? "yes" : undefined,
      },
      channel: args.channel,
      commercial_state: {
        lead_status: args.commercialState.leadStatus || "new",
        touch_count: args.commercialState.touchCount ?? 0,
        last_outcome: args.commercialState.lastOutcome ?? undefined,
        days_since_last_inbound: args.commercialState.daysSinceLastInbound ?? undefined,
        has_active_conversation: !!args.commercialState.hasActiveConversation,
      },
      partner: {
        id: args.partner.id ?? null,
        company_name: args.partner.company_name ?? undefined,
        country: args.partner.country ?? undefined,
      },
      contact: args.contact
        ? { name: args.contact.name ?? null, role: args.contact.role ?? null }
        : undefined,
      history_summary: args.historySummary ?? undefined,
      kb_summary: args.kbSummary ?? undefined,
      is_reply: !!args.isReply,
      original_inbound: args.originalInbound,
    }, { mode: optimus.mode, strictness });

    const finalText = review.verdict !== "block" && review.edited_text
      ? review.edited_text
      : args.draft;

    return { review, finalText, enabled: true };
  } catch (e) {
    console.warn(
      "[postGenerationReview] runJournalistReview failed:",
      e instanceof Error ? e.message : e,
    );
    return { ...fallback, enabled: true };
  }
}

/** Helper per serializzare il review in un payload JSON-friendly. */
export function serializeJournalistReview(
  review: JournalistReviewOutput | null,
): Record<string, unknown> | null {
  if (!review) return null;
  return {
    journalist: review.journalist,
    verdict: review.verdict,
    warnings: review.warnings,
    edits: review.edits,
    quality_score: review.quality_score,
    reasoning: review.reasoning_summary,
  };
}