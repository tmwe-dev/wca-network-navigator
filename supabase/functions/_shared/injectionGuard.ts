/**
 * _shared/injectionGuard.ts — Anti-Prompt-Injection Confirmation Guard
 *
 * Logica:
 *  1. Detect: usa promptSanitizer.detectInjection sui contenuti grezzi (post-normalize, pre-prompt).
 *  2. Se findings HIGH presenti → cerca/crea record in `prompt_injection_reviews`.
 *  3. Se review ha status="approved" (l'utente ha già confermato lo stesso contenuto) → lascia passare.
 *  4. Altrimenti → ritorna { needsConfirmation: true, reviewId } e il caller risponde 409 al client.
 *
 *  Il caller tipico:
 *      const guard = await checkInjectionGuard(supabase, {
 *        userId, source: "email-inbound", functionName: "classify-inbound-message",
 *        text: bodyText, reviewToken: req.headers.get("x-injection-review-id"),
 *      });
 *      if (guard.needsConfirmation) {
 *        return new Response(JSON.stringify({
 *          error: "prompt_injection_review_required",
 *          review_id: guard.reviewId,
 *          findings: guard.findings,
 *        }), { status: 409, headers });
 *      }
 *      // ...prosegui con AI...
 *
 * Il review viene riconosciuto dallo stesso content_hash → niente duplicati per lo stesso testo.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

import {
  detectInjection,
  type SanitizeFinding,
  type UntrustedSource,
} from "./promptSanitizer.ts";

export interface InjectionGuardInput {
  userId: string;
  source: UntrustedSource;
  functionName: string;
  /** Testo grezzo (post-normalize è meglio) su cui fare detection. */
  text: string | null | undefined;
  /** Se il client passa un review_id già approvato per lo stesso contenuto, bypassa. */
  reviewToken?: string | null;
  /** Metadata extra da loggare nella riga di review (es. message_id). */
  metadata?: Record<string, unknown>;
  /** Soglia minima di severity che richiede conferma. Default "high". */
  minSeverity?: "medium" | "high";
}

export interface InjectionGuardResult {
  needsConfirmation: boolean;
  reviewId: string | null;
  findings: SanitizeFinding[];
  reason?: string;
}

/** SHA-256 esadecimale (deno std). */
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function severityRank(s: "low" | "medium" | "high"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

/**
 * Esegue il check guard.
 * Non lancia: in caso di errore DB ritorna `needsConfirmation:false` (fail-open
 * sul DB ma fail-closed sull'AI è già garantito dal sanitizer redact).
 */
export async function checkInjectionGuard(
  supabase: SupabaseClient,
  input: InjectionGuardInput,
): Promise<InjectionGuardResult> {
  const text = (input.text ?? "").toString();
  if (!text.trim()) {
    return { needsConfirmation: false, reviewId: null, findings: [] };
  }

  const findings = detectInjection(text);
  if (!findings.length) {
    return { needsConfirmation: false, reviewId: null, findings: [] };
  }

  const minRank = severityRank(input.minSeverity ?? "high");
  const triggering = findings.filter((f) => severityRank(f.severity) >= minRank);
  if (!triggering.length) {
    // Solo low/medium → log, ma non bloccare.
    return { needsConfirmation: false, reviewId: null, findings };
  }

  const highest = triggering.reduce(
    (acc, f) => (severityRank(f.severity) > severityRank(acc) ? f.severity : acc),
    "low" as "low" | "medium" | "high",
  );

  const contentHash = await sha256Hex(`${input.source}|${text}`);

  // 1) Se il client ha passato un reviewToken, verificalo.
  if (input.reviewToken) {
    try {
      const { data: tokenRow } = await supabase
        .from("prompt_injection_reviews")
        .select("id,status,user_id,content_hash,expires_at")
        .eq("id", input.reviewToken)
        .maybeSingle();
      if (
        tokenRow &&
        tokenRow.user_id === input.userId &&
        tokenRow.content_hash === contentHash &&
        tokenRow.status === "approved" &&
        new Date(tokenRow.expires_at) > new Date()
      ) {
        return { needsConfirmation: false, reviewId: tokenRow.id, findings, reason: "approved-token" };
      }
    } catch (_e) {
      // continua con flusso normale
    }
  }

  // 2) Cerca review esistente per lo stesso contenuto.
  try {
    const { data: existing } = await supabase
      .from("prompt_injection_reviews")
      .select("id,status,expires_at")
      .eq("user_id", input.userId)
      .eq("content_hash", contentHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const expired = new Date(existing.expires_at) < new Date();
      if (existing.status === "approved" && !expired) {
        return { needsConfirmation: false, reviewId: existing.id, findings, reason: "approved-prev" };
      }
      if (existing.status === "rejected" && !expired) {
        return { needsConfirmation: true, reviewId: existing.id, findings, reason: "rejected-prev" };
      }
      if (existing.status === "pending" && !expired) {
        return { needsConfirmation: true, reviewId: existing.id, findings, reason: "pending-prev" };
      }
      // expired or other → crea nuovo record
    }
  } catch (_e) {
    // continua creando nuovo record
  }

  // 3) Crea nuova review pending.
  const preview = text.length > 500 ? text.slice(0, 500) + "…" : text;
  try {
    const { data: created } = await supabase
      .from("prompt_injection_reviews")
      .insert({
        user_id: input.userId,
        source: input.source,
        function_name: input.functionName,
        content_hash: contentHash,
        content_preview: preview,
        findings: triggering,
        highest_severity: highest,
        status: "pending",
        metadata: input.metadata ?? {},
      })
      .select("id")
      .maybeSingle();

    return {
      needsConfirmation: true,
      reviewId: created?.id ?? null,
      findings: triggering,
      reason: "new-review",
    };
  } catch (e) {
    // Fail-open su DB error: lascia procedere (sanitizer comunque redact).
    console.warn("[injectionGuard] insert failed:", (e as Error).message);
    return { needsConfirmation: false, reviewId: null, findings: triggering, reason: "db-error" };
  }
}

/**
 * Risolve una review: chiamata dall'edge function `confirm-injection-review`.
 */
export async function resolveInjectionReview(
  supabase: SupabaseClient,
  reviewId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("prompt_injection_reviews")
    .update({
      status: decision,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      decision_reason: reason ?? null,
    })
    .eq("id", reviewId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
