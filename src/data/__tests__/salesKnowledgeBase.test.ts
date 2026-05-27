import { describe, it, expect } from "vitest";
import * as m from "@/data/salesKnowledgeBase";
describe("DAL — salesKnowledgeBase", () => {
  it("module loads", () => expect(m).toBeDefined());
  it("has string exports", () => {
    const strs = Object.values(m).filter((v) => typeof v === "string");
    expect(strs.length + Object.values(m).filter(Array.isArray).length).toBeGreaterThan(0);
  });
});
