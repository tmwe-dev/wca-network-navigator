import { describe, it, expect, beforeEach, vi } from "vitest";
import { addCockpitPreselection, consumeCockpitPreselection, getCockpitPreselection } from "@/lib/cockpitPreselection";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe("cockpitPreselection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds and retrieves preselection IDs", () => {
    addCockpitPreselection(["id1", "id2"]);
    expect(getCockpitPreselection()).toEqual(["id1", "id2"]);
  });

  it("consumes and clears preselection", () => {
    addCockpitPreselection(["id1"]);
    const consumed = consumeCockpitPreselection();
    expect(consumed).toEqual(["id1"]);
    expect(getCockpitPreselection()).toEqual([]);
  });

  it("merges and deduplicates IDs", () => {
    addCockpitPreselection(["id1", "id2"]);
    addCockpitPreselection(["id2", "id3"]);
    expect(getCockpitPreselection()).toEqual(["id1", "id2", "id3"]);
  });

  it("handles empty input gracefully", () => {
    addCockpitPreselection([]);
    expect(getCockpitPreselection()).toEqual([]);
  });
});
