/**
 * auditLogger.ts — Log redatto di ogni invocazione Super Mario.
 *
 * - Hash SHA256 del prompt completo (no plaintext).
 * - Snippet redatto della risposta (PII-safe, troncato).
 * - Persiste in super_mario_invocations (auto-retention 30gg via expires_at).
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"],
  [/\+?\d[\d\s().-]{7,}\d/g, "[phone]"],
];

function redact(text: string): string {
  let out = text;
  for (const [re, repl] of PII_PATTERNS) out = out.replace(re, repl);
  return out;
}

export interface AuditPayload {
  trace_id: string;
  conversation_id: string | null;
  operator_id: string | null;
  scope: string;
  domain: string;
  system_prompt: string;
  user_message: string;
  response_text: string;
  tool_calls: Array<{ tool_name: string; arguments: Record<string, unknown> }>;
  loaded_kb_cards: Array<{ source: string; id: string; name: string }>;
  violations: Array<{ code: string; message: string; severity: string }>;
  preflight_warnings: string[];
  latency_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  model: string;
  ok: boolean;
  failure_reason?: string;
}

export async function logInvocation(supabase: SupabaseClient, p: AuditPayload): Promise<void> {
  try {
    const promptHash = await sha256(p.system_prompt + p.user_message);
    const redactedPrompt = redact(p.system_prompt + "\n---USER---\n" + p.user_message).slice(0, 4000);
    const responseSnippet = redact(p.response_text).slice(0, 1000);

    const auditWarnings = {
      preflight: p.preflight_warnings,
      violations: p.violations,
      domain: p.domain,
      loaded_kb_cards: p.loaded_kb_cards,
      ok: p.ok,
      failure_reason: p.failure_reason ?? null,
    };

    await supabase.from("super_mario_invocations").insert({
      trace_id: p.trace_id,
      conversation_id: p.conversation_id,
      operator_id: p.operator_id,
      scope: p.scope,
      model: p.model,
      prompt_tokens: p.prompt_tokens ?? 0,
      completion_tokens: p.completion_tokens ?? 0,
      latency_ms: p.latency_ms,
      final_prompt_hash: promptHash,
      final_prompt_redacted: redactedPrompt,
      response_summary: responseSnippet,
      tool_calls_json: p.tool_calls,
      audit_warnings: auditWarnings,
      error_code: p.ok ? null : (p.failure_reason ?? "unknown"),
    });
  } catch (e) {
    console.warn("[super-mario] audit log failed", { error: (e as Error).message });
  }
}
