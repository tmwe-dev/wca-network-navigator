import { describe, it, expect } from "vitest";
describe("tokenEstimator", () => {
  it("module loads", async () => {
    const mod = await import("@/lib/tokenEstimator");
    expect(mod).toBeDefined();
  });
});
