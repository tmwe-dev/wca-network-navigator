import { describe, it, expect } from "vitest";
import * as m from "@/data/kbSeedData";
describe("DAL — kbSeedData", () => {
  it("module loads", () => expect(Object.keys(m).length).toBeGreaterThan(0));
});
