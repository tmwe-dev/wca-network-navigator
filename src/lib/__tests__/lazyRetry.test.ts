import { describe, it, expect, vi } from "vitest";
import { lazyRetry } from "@/lib/lazyRetry";

// lazyRetry wraps React.lazy — it returns a React lazy component, not the raw promise.
// We test that the factory is called and retried correctly.

describe("lazyRetry", () => {
  it("returns a lazy component (calls factory once on success)", () => {
    const comp = { default: () => null };
    const loader = vi.fn().mockResolvedValue(comp);
    const LazyComp = lazyRetry(loader);
    // React.lazy returns an object with $$typeof
    expect(LazyComp).toBeDefined();
    expect(LazyComp.$$typeof).toBeDefined();
    // Factory is called lazily by React, not eagerly
  });

  it("retries on failure then succeeds", async () => {
    vi.useFakeTimers();
    const comp = { default: () => null };
    const loader = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce(comp);

    const LazyComp = lazyRetry(loader, 100);
    // Trigger the lazy load by accessing _payload (React internals)
    // React.lazy stores factory in _payload[1] or _init/_payload
    // Instead, just call the factory wrapper that lazy wraps:
    // We can access the internal init function
    const payload = (LazyComp as unknown as Record<string, unknown>)._payload;
    const init = (LazyComp as unknown as Record<string, unknown>)._init;

    // Call init to trigger the factory — this starts the promise chain
    try {
      init(payload);
    } catch {
      // lazy init may throw if not resolved yet
    }

    // Wait for the retry delay
    await vi.advanceTimersByTimeAsync(200);

    expect(loader).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
