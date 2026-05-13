import { describe, it, expect } from "vitest";
describe("senderDisplayName", () => {
  it("module loads", async () => {
    const mod = await import("@/lib/senderDisplayName");
    expect(mod).toBeDefined();
  });
});
