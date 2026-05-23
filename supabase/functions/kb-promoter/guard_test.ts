import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("kb-promoter: cron gate attivo", () => {
  assert(SRC.includes("cronPausedResponse"));
  assert(SRC.includes('"kb-promoter"'));
});

Deno.test("kb-promoter: opera solo su auto_generated", () => {
  const overlaps = SRC.match(/overlaps\("tags", \["auto_generated"\]\)/g) || [];
  assert(overlaps.length >= 3, `expected 3 overlaps tags auto_generated, got ${overlaps.length}`);
});

Deno.test("kb-promoter: nessun .single() e nessun DELETE", () => {
  assertEquals((SRC.match(/\.single\(\)/g) || []).length, 0);
  assertEquals((SRC.match(/\.delete\(\)/g) || []).length, 0);
});

Deno.test("kb-promoter: soglie promotion immutate (5/15/30gg)", () => {
  assert(SRC.includes('.gte("access_count", 5)'));
  assert(SRC.includes('.gte("access_count", 15)'));
  assert(SRC.includes("30 * 24 * 60 * 60 * 1000"));
});