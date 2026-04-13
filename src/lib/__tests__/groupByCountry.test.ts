import { describe, it, expect } from "vitest";
import { groupByCountry } from "@/lib/groupByCountry";

interface TestItem { code: string; name: string; value: number }

const getCode = (i: TestItem) => i.code;
const getName = (i: TestItem) => i.name;

describe("groupByCountry", () => {
  it("groups items by country code", () => {
    const items: TestItem[] = [
      { code: "IT", name: "Italy", value: 1 },
      { code: "DE", name: "Germany", value: 2 },
      { code: "IT", name: "Italy", value: 3 },
    ];
    const groups = groupByCountry(items, getCode, getName);
    expect(groups).toHaveLength(2);
    expect(groups[0].countryCode).toBe("IT");
    expect(groups[0].items).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(groupByCountry([], getCode, getName)).toEqual([]);
  });

  it("creates single group when all items have same country", () => {
    const items: TestItem[] = [
      { code: "US", name: "USA", value: 1 },
      { code: "US", name: "USA", value: 2 },
    ];
    const groups = groupByCountry(items, getCode, getName);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  it("sorts groups by size descending", () => {
    const items: TestItem[] = [
      { code: "DE", name: "Germany", value: 1 },
      { code: "IT", name: "Italy", value: 2 },
      { code: "IT", name: "Italy", value: 3 },
      { code: "IT", name: "Italy", value: 4 },
    ];
    const groups = groupByCountry(items, getCode, getName);
    expect(groups[0].countryCode).toBe("IT");
    expect(groups[1].countryCode).toBe("DE");
  });
});
