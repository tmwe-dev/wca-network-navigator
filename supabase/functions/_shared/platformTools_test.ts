/**
 * platformTools Deno test — Vol. I Fase 5 (guardrails).
 * Verifica integrità delle definizioni PLATFORM_TOOLS leggendo il file sorgente.
 * Non importa il modulo direttamente per evitare side effects (client Supabase).
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const source = await Deno.readTextFile(new URL("./platformTools.ts", import.meta.url));

function extractToolNames(): string[] {
  const section = source.split("export const PLATFORM_TOOLS")[1]?.split("];")[0] ?? "";
  return [...section.matchAll(/name:\s*"([^"]+)"/g)].map(m => m[1]);
}

function extractHandlerCases(): string[] {
  const section = source.split("export async function executePlatformTool")[1] ?? "";
  return [...section.matchAll(/case\s+"([^"]+)":/g)].map(m => m[1]);
}

const toolNames = extractToolNames();
const handlerCases = extractHandlerCases();

Deno.test("ha almeno 30 tool definiti", () => {
  assert(toolNames.length >= 30, `Expected >= 30, got ${toolNames.length}`);
});

Deno.test("nomi unici (nessun duplicato)", () => {
  const dupes = toolNames.filter((n, i) => toolNames.indexOf(n) !== i);
  assertEquals(dupes, []);
});

Deno.test("ogni tool ha un handler nel switch", () => {
  const missing = toolNames.filter(n => !handlerCases.includes(n));
  assertEquals(missing, [], `Tool senza handler: ${missing.join(", ")}`);
});

Deno.test("ogni handler ha una definizione tool", () => {
  const orphans = handlerCases.filter(n => !toolNames.includes(n));
  assertEquals(orphans, [], `Handler orfani: ${orphans.join(", ")}`);
});

Deno.test("ogni tool name è snake_case", () => {
  for (const name of toolNames) {
    assert(/^[a-z][a-z0-9_]*$/.test(name), `"${name}" non è snake_case`);
  }
});
