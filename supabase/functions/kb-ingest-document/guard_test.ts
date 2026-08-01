import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("kb-ingest-document: auth Bearer obbligatoria", () => {
  assert(SRC.includes('authHeader?.startsWith("Bearer ")'));
  assert(SRC.includes('"unauthorized"'));
});

Deno.test("kb-ingest-document: limite dimensione file enforced", () => {
  assert(SRC.includes("MAX_FILE_BYTES"));
  assert(SRC.includes('"file_too_large"'));
});

Deno.test("kb-ingest-document: nessun .single() rischioso", () => {
  const singleMatches = SRC.match(/\.single\(\)/g) || [];
  assertEquals(singleMatches.length, 0);
});

Deno.test("kb-ingest-document: insert in batch su kb_entries", () => {
  assert(SRC.includes('.from("kb_entries")'));
  assert(SRC.includes(".insert(batch)"));
});