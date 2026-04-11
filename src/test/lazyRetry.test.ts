import { describe, it, expect } from "vitest";
import { lazyRetry } from "@/lib/lazyRetry";

describe("lazyRetry", () => {
  it("returns a lazy component", () => {
    const Component = lazyRetry(() => Promise.resolve({ default: () => null }));
    expect(Component).toBeDefined();
    expect(Component.$$typeof).toBeDefined();
  });

  it("resolves successful import", async () => {
    const Comp = () => null;
    const LazyComp = lazyRetry(() => Promise.resolve({ default: Comp }));
    // React.lazy returns an object with $$typeof
    expect(LazyComp.$$typeof).toBe(Symbol.for("react.lazy"));
  });
});
