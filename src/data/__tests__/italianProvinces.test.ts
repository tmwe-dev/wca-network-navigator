import { describe, it, expect } from "vitest";
import * as m from "@/data/italianProvinces";
describe("DAL — italianProvinces", () => {
  it("module loads", () => expect(m).toBeDefined());
  it("has at least one export array", () => {
    const arrays = Object.values(m).filter((v) => Array.isArray(v));
    expect(arrays.length).toBeGreaterThan(0);
  });
});
