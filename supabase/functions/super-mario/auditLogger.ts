/**
 * auditLogger.ts — Log redatto di ogni invocazione Super Mario.
 *
 * - Hash SHA256 del prompt completo (no plaintext).
 * - Snippet redatto della risposta (PII-safe, troncato).
 * - Metadati: scope, dominio KB, n. tool_calls, tempi, violazioni.
 * - Persiste in super_mario_invocations (auto-retention 30gg via cron).
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
  user_id: string;
  scope: string;
  conversation_id: string | null;
  domain: string;
  system_prompt: string;
  user_message: string;
  response_text: string;
  tool_calls_count: number;
  needs_confirmation: boolean;
  loaded_kb_cards: Array<{ source: string; id: string; name: string }>;
  violations: Array<{ code: string; message: string; severity: string }>;
  preflight_warnings: string[];
  latency_ms: number;
  model: string;
  ok: boolean;
  failure_reason?: string;
}

export async function logInvocation(supabase: SupabaseClient, p: AuditPayload): Promise<void> {
  try {
    const promptHash = await sha256(p.system_prompt);
    const responseSnippet = redact(p.response_text).slice(0, 500);

    await supabase.from("super_mario_invocations").insert({
      user_id: p.user_id,
      scope: p.scope,
      conversation_id: p.conversation_id,
      domain: p.domain,
      prompt_hash: promptHash,
      prompt_size_chars: p.system_prompt.length + p.user_message.length,
      response_snippet: responseSnippet,
      tool_calls_count: p.tool_calls_count,
      needs_confirmation: p.needs_confirmation,
      loaded_kb_cards: p.loaded_kb_cards,
      violations: p.violations,
      preflight_warnings: p.preflight_warnings,
      latency_ms: p.latency_ms,
      model: p.model,
      ok: p.ok,
      failure_reason: p.failure_reason ?? null,
    });
  } catch (e) {
    console.warn("[super-mario] audit log failed", { error: (e as Error).message });
  }
}
