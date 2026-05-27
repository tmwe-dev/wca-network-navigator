import { describe, it, expect } from "vitest";
import { ATECO_TREE } from "@/data/atecoCategories";
describe("DAL — atecoCategories", () => {
  it("tree not empty", () => expect(ATECO_TREE.length).toBeGreaterThan(50));
  it("each entry has codice/descrizione/livello", () => {
    for (const e of ATECO_TREE) {
      expect(e.codice).toBeTruthy();
      expect(e.descrizione).toBeTruthy();
      expect([1, 2, 3]).toContain(e.livello);
    }
  });
  it("livello 1 entries have empty padre", () => {
    const l1 = ATECO_TREE.filter((e) => e.livello === 1);
    expect(l1.length).toBeGreaterThan(0);
    for (const e of l1) expect(e.padre).toBe("");
  });
});
