import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("kb-supervisor: read-only (no UPDATE/DELETE/INSERT su kb_entries)", () => {
  // Audit-only: deve solo leggere kb_entries
  const forbidden = [
    /\.from\("kb_entries"\)[\s\S]{0,200}\.update\(/,
    /\.from\("kb_entries"\)[\s\S]{0,200}\.delete\(/,
    /\.from\("kb_entries"\)[\s\S]{0,200}\.insert\(/,
  ];
  for (const re of forbidden) {
    assert(!re.test(SRC), `kb-supervisor non deve mutare kb_entries: ${re}`);
  }
});

Deno.test("kb-supervisor: user_id obbligatorio", () => {
  assert(SRC.includes('"user_id required"'));
});

Deno.test("kb-supervisor: nessun .single()", () => {
  assertEquals((SRC.match(/\.single\(\)/g) || []).length, 0);
});