import { describe, it, expect } from "vitest";
import { groupByCountry } from "@/lib/groupByCountry";

interface TestItem { id: number; code: string; name: string }

describe("groupByCountry", () => {
  const items: TestItem[] = [
    { id: 1, code: "IT", name: "Italy" },
    { id: 2, code: "IT", name: "Italy" },
    { id: 3, code: "DE", name: "Germany" },
    { id: 4, code: "IT", name: "Italy" },
  ];

  it("groups items by country code", () => {
    const groups = groupByCountry(items, i => i.code, i => i.name);
    expect(groups).toHaveLength(2);
  });

  it("sorts by group size descending", () => {
    const groups = groupByCountry(items, i => i.code, i => i.name);
    expect(groups[0].countryCode).toBe("IT");
    expect(groups[0].items).toHaveLength(3);
    expect(groups[1].countryCode).toBe("DE");
    expect(groups[1].items).toHaveLength(1);
  });

  it("handles empty array", () => {
    const groups = groupByCountry([], (i: TestItem) => i.code, (i: TestItem) => i.name);
    expect(groups).toHaveLength(0);
  });

  it("uses ?? fallback for missing code", () => {
    const items2 = [{ id: 1, code: "", name: "Unknown" }];
    const groups = groupByCountry(items2, i => i.code, i => i.name);
    expect(groups[0].countryCode).toBe("??");
  });
});
