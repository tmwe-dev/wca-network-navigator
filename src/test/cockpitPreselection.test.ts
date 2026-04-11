import { describe, it, expect, vi, beforeEach } from "vitest";
import { addCockpitPreselection, consumeCockpitPreselection, getCockpitPreselection } from "@/lib/cockpitPreselection";

describe("cockpitPreselection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds IDs to storage", () => {
    addCockpitPreselection(["a", "b"]);
    expect(getCockpitPreselection()).toEqual(["a", "b"]);
  });

  it("merges with existing IDs (deduped)", () => {
    addCockpitPreselection(["a", "b"]);
    addCockpitPreselection(["b", "c"]);
    expect(getCockpitPreselection()).toEqual(["a", "b", "c"]);
  });

  it("consume reads and clears", () => {
    addCockpitPreselection(["x", "y"]);
    const ids = consumeCockpitPreselection();
    expect(ids).toEqual(["x", "y"]);
    expect(getCockpitPreselection()).toEqual([]);
  });

  it("consume returns empty array when nothing stored", () => {
    expect(consumeCockpitPreselection()).toEqual([]);
  });

  it("does not add on empty array", () => {
    addCockpitPreselection([]);
    expect(getCockpitPreselection()).toEqual([]);
  });
});
