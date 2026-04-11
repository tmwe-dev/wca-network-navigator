/**
 * Tests: Retry with backoff
 */
import { describe, it, expect } from "vitest";
import { withRetry } from "../bridge/retry";
import { isOk, isErr } from "../core/domain/result";

describe("Retry", () => {
  it("returns Ok on first success", async () => {
    const r = await withRetry(async () => "success", { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    expect(isOk(r) && r.value).toBe("success");
  });

  it("retries on failure and succeeds", async () => {
    let attempt = 0;
    const r = await withRetry(
      async () => {
        attempt++;
        if (attempt < 3) throw new Error("not yet");
        return "done";
      },
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
    );
    expect(isOk(r) && r.value).toBe("done");
    expect(attempt).toBe(3);
  });

  it("returns Err after all attempts exhausted", async () => {
    const r = await withRetry(
      async () => { throw new Error("always fail"); },
      { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 10 },
    );
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toContain("always fail");
  });

  it("respects shouldRetry predicate", async () => {
    let attempts = 0;
    const r = await withRetry(
      async () => { attempts++; throw new Error("stop"); },
      {
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 10,
        shouldRetry: () => false,
      },
    );
    expect(isErr(r)).toBe(true);
    expect(attempts).toBe(1);
  });
});
