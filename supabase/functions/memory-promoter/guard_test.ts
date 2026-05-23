import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("memory-promoter: cron gate attivo", () => {
  assert(SRC.includes("cronPausedResponse"));
  assert(SRC.includes('"memory-promoter"'));
});

Deno.test("memory-promoter: scarta memorie con feedback negativo da promotion L3", () => {
  assert(SRC.includes('m.feedback !== "negative"'));
});

Deno.test("memory-promoter: nessun .single() rischioso", () => {
  assertEquals((SRC.match(/\.single\(\)/g) || []).length, 0);
});

Deno.test("memory-promoter: livelli e decay_rate immutati", () => {
  // L1→L2 promotion
  assert(SRC.includes("level: 2"));
  assert(SRC.includes("decay_rate: 0.005"));
  // L2→L3 promotion (durable: decay 0)
  assert(SRC.includes("level: 3"));
  assert(SRC.includes("decay_rate: 0"));
});

Deno.test("memory-promoter: delete protetto da .in(ids) (mai bulk wipe)", () => {
  const deletes = SRC.match(/\.delete\(\)\.in\("id",/g) || [];
  assert(deletes.length >= 2, `expected scoped deletes, got ${deletes.length}`);
  // Nessun delete senza scope
  assert(!/\.delete\(\)\s*[\)\s,;}]/.test(SRC.replace(/\.delete\(\)\.in\("id",[^)]+\)/g, "")));
});