import { describe, it, expect } from "vitest";
describe("apiError", () => {
  it("module loads", async () => {
    const mod = await import("@/lib/api/apiError");
    expect(mod).toBeDefined();
  });
});
