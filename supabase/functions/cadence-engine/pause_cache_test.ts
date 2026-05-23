import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createPauseChecker } from "./index.ts";

Deno.test("createPauseChecker — single user_id triggers lookup once", async () => {
  let calls = 0;
  const check = createPauseChecker(async (uid) => {
    calls++;
    return uid === "paused-user";
  });
  assertEquals(await check("u1"), false);
  assertEquals(await check("u1"), false);
  assertEquals(await check("u1"), false);
  assertEquals(calls, 1, "lookup must be cached after first call");
});

Deno.test("createPauseChecker — distinct users → 1 lookup each", async () => {
  let calls = 0;
  const check = createPauseChecker(async (uid) => {
    calls++;
    return uid === "p";
  });
  await check("a"); await check("b"); await check("p"); await check("a"); await check("b");
  assertEquals(calls, 3);
});

Deno.test("createPauseChecker — caches false AND true verdicts", async () => {
  let calls = 0;
  const check = createPauseChecker(async (uid) => {
    calls++;
    return uid === "paused";
  });
  assertEquals(await check("paused"), true);
  assertEquals(await check("paused"), true);
  assertEquals(await check("ok"), false);
  assertEquals(await check("ok"), false);
  assertEquals(calls, 2);
});