import { describe, it, expect } from "vitest";
describe("syncGuard", () => {
  it("module loads", async () => {
    const mod = await import("@/lib/syncGuard");
    expect(mod).toBeDefined();
  });
});
