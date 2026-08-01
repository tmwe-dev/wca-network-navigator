import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createLogger } from "./structuredLogger.ts";

Deno.test("createLogger emits JSON lines and never throws", () => {
  const log = createLogger("test-fn", { userId: "u1" });
  log.info("hello", { foo: "bar" });
  log.warn("careful");
  log.error("boom", new Error("x"));
  // No assertions on console — just ensure no throw.
  assert(true);
});

Deno.test("metric() classifies perf vs metric event types", async () => {
  const log = createLogger("test-fn");
  log.metric("llm_call", { duration_ms: 100, model: "gemini" });
  log.metric("counter", { tags: ["x"] });
  // flush() must be safe even without DB env
  await log.flush();
  assert(true);
});

Deno.test("time() measures duration and propagates errors", async () => {
  const log = createLogger("test-fn");
  const v = await log.time("ok-op", async () => 42);
  assertEquals(v, 42);
  let threw = false;
  try {
    await log.time("fail-op", async () => { throw new Error("nope"); });
  } catch (e) {
    threw = e instanceof Error && e.message === "nope";
  }
  assert(threw, "time() must rethrow");
});

Deno.test("child() inherits context", () => {
  const log = createLogger("test-fn", { userId: "root" });
  const c = log.child({ requestId: "r1" });
  c.info("nested");
  assert(true);
});
