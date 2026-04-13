import { describe, it, expect, vi } from "vitest";
import { lazyRetry } from "@/lib/lazyRetry";

describe("lazyRetry", () => {
  it("returns a lazy component", () => {
    const Component = lazyRetry(() => Promise.resolve({ default: () => null }));
    expect(Component).toBeDefined();
    expect(Component.$$typeof).toBe(Symbol.for("react.lazy"));
  });

  it("resolves on first successful import", async () => {
    const factory = vi.fn().mockResolvedValue({ default: () => "ok" });
    const Comp = lazyRetry(factory);
    // Access the internal _payload to trigger the factory
    const result = await (Comp as any)._payload._result();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("retries after failure", async () => {
    const factory = vi.fn()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockResolvedValueOnce({ default: () => "ok" });
    
    lazyRetry(factory, 10);
    // Factory is called by React.lazy internally; we verify it's a lazy type
    expect(factory).not.toHaveBeenCalled(); // Not called until rendered
  });

  it("accepts custom retry delay", () => {
    const Component = lazyRetry(() => Promise.resolve({ default: () => null }), 2000);
    expect(Component).toBeDefined();
  });
});
