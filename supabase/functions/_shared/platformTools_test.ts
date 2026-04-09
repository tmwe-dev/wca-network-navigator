/**
 * platformTools Deno test — Vol. I Fase 5 (guardrails).
 * Verifica integrità delle definizioni PLATFORM_TOOLS senza connessione DB.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PLATFORM_TOOLS } from "./platformTools.ts";

Deno.test("PLATFORM_TOOLS è un array non vuoto", () => {
  assert(Array.isArray(PLATFORM_TOOLS));
  assert(PLATFORM_TOOLS.length >= 30, `Expected >= 30 tools, got ${PLATFORM_TOOLS.length}`);
});

Deno.test("ogni tool ha type 'function' e struttura function valida", () => {
  for (const tool of PLATFORM_TOOLS) {
    const t = tool as { type: string; function: { name: string; description: string; parameters: { type: string } } };
    assertEquals(t.type, "function", `Tool has wrong type: ${JSON.stringify(t)}`);
    assert(typeof t.function.name === "string" && t.function.name.length > 0, "Missing name");
    assert(typeof t.function.description === "string" && t.function.description.length > 0, "Missing description");
    assertEquals(t.function.parameters.type, "object", `Parameters type wrong for ${t.function.name}`);
  }
});

Deno.test("nomi dei tool sono univoci", () => {
  const names = PLATFORM_TOOLS.map((t: any) => t.function.name);
  const unique = new Set(names);
  assertEquals(names.length, unique.size, `Duplicati trovati: ${names.filter((n: string, i: number) => names.indexOf(n) !== i)}`);
});

Deno.test("ogni tool name usa snake_case", () => {
  const names = PLATFORM_TOOLS.map((t: any) => t.function.name as string);
  for (const name of names) {
    assert(/^[a-z][a-z0-9_]*$/.test(name), `"${name}" non è snake_case`);
  }
});
