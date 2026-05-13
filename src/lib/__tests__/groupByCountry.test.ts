import { describe, it, expect } from "vitest";
import { groupByCountry } from "@/lib/groupByCountry";
describe("groupByCountry", () => {
  it("groups items by country", () => {
    const items = [
      { country: "IT", name: "a" },
      { country: "US", name: "b" },
      { country: "IT", name: "c" },
    ];
    const grouped = groupByCountry(items);
    expect(grouped["IT"]).toHaveLength(2);
    expect(grouped["US"]).toHaveLength(1);
  });
  it("handles empty array", () => {
    expect(groupByCountry([])).toEqual({});
  });
});
