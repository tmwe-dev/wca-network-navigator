import { describe, it, expect } from "vitest";
import { DEFAULT_EMAIL_TYPES } from "@/data/defaultEmailTypes";
describe("DAL — defaultEmailTypes", () => {
  it("not empty", () => expect(DEFAULT_EMAIL_TYPES.length).toBeGreaterThan(0));
  it("each has id/name", () => {
    for (const t of DEFAULT_EMAIL_TYPES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
    }
  });
  it("ids unique", () => {
    const ids = DEFAULT_EMAIL_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
