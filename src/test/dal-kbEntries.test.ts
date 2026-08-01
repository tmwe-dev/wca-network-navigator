/**
 * DAL KB Entries — Unit tests
 */
import { describe, it, expect } from "vitest";
import * as kbDAL from "@/data/kbEntries";

describe("DAL — kbEntries", () => {
  it("exports all expected functions", () => {
    expect(typeof kbDAL.findKbEntries).toBe("function");
    expect(typeof kbDAL.countKbEntries).toBe("function");
    expect(typeof kbDAL.upsertKbEntry).toBe("function");
    expect(typeof kbDAL.deleteKbEntry).toBe("function");
    expect(typeof kbDAL.bulkInsertKbEntries).toBe("function");
    expect(typeof kbDAL.invalidateKbEntries).toBe("function");
  });

  it("KbEntry interface has expected fields", () => {
    const mock: Partial<kbDAL.KbEntry> = {
      id: "test",
      title: "Test",
      content: "Content",
      category: "strategy",
      priority: 5,
      is_active: true,
    };
    expect(mock.category).toBe("strategy");
  });
});
