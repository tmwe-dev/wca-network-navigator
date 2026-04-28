#!/usr/bin/env -S deno run --allow-read
/**
 * audit-ai-invocations — Charter R8.
 *
 * Scansiona src/ alla ricerca di chiamate dirette a edge function AI senza
 * passare dal gateway invokeAi. Esce con codice non-zero per fallire la CI.
 *
 * Esegui: bun scripts/audit-ai-invocations.ts
 */
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const AI_FUNCTIONS = new Set<string>([
  "ai-assistant", "agent-execute", "agent-loop", "agent-simulate",
  "agent-prompt-refiner", "agent-task-drainer", "unified-assistant",
  "generate-email", "generate-outreach", "improve-email",
  "classify-email-response", "classify-inbound-message",
  "categorize-content", "suggest-email-groups", "parse-business-card",
  "agentic-decide", "sherlock-extract", "prompt-test-runner", "daily-briefing",
]);

const ALLOWED_FILES = new Set<string>([
  "src/lib/ai/invokeAi.ts",
  "src/lib/api/invokeEdge.ts",
  "src/test/invoke-edge.test.ts",
]);

const DIRECT_INVOKE_RE =
  /(?:supabase\.functions\.invoke|invokeEdge)\(\s*["']([^"']+)["']/g;

const violations: { file: string; line: number; fn: string }[] = [];

for await (const entry of walk("src", { includeDirs: false, exts: [".ts", ".tsx"] })) {
  if (ALLOWED_FILES.has(entry.path)) continue;
  const content = await Deno.readTextFile(entry.path);
  const lines = content.split("\n");
  let m: RegExpExecArray | null;
  while ((m = DIRECT_INVOKE_RE.exec(content)) !== null) {
    const fn = m[1];
    if (!AI_FUNCTIONS.has(fn)) continue;
    // Find line number
    const upto = content.slice(0, m.index);
    const line = upto.split("\n").length;
    // Heuristica: ammessa se sulla stessa riga (o nelle 3 successive) c'è "scope:"
    const window = lines.slice(line - 1, line + 6).join("\n");
    if (/\bscope\s*:/.test(window)) continue; // legacy con scope inline → ok temporaneo
    violations.push({ file: entry.path, line, fn });
  }
}

if (violations.length === 0) {
  console.log("✅ AI Invocation Charter: nessuna violazione trovata.");
  Deno.exit(0);
}

console.error(`❌ AI Invocation Charter: ${violations.length} violazioni`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  → ${v.fn}() — usare invokeAi() invece`);
}
console.error(`\nVedi docs/ai/AI_INVOCATION_CHARTER.md`);
Deno.exit(1);