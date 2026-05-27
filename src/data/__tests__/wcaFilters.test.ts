import { describe, it, expect } from "vitest";
import * as m from "@/data/wcaFilters";
describe("DAL — wcaFilters", () => {
  it("WCA_NETWORKS non vuoto", () => expect(m.WCA_NETWORKS.length).toBeGreaterThan(0));
  it("module exports loadable", () => expect(m).toBeDefined());
});
