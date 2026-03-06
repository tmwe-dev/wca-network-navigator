import { describe, it, expect } from "vitest";
import { groupByCountry } from "./groupByCountry";

interface TestItem {
  id: number;
  countryCode: string;
  countryName: string;
}

const getCode = (item: TestItem) => item.countryCode;
const getName = (item: TestItem) => item.countryName;

describe("groupByCountry", () => {
  it("groups items by country code", () => {
    const items: TestItem[] = [
      { id: 1, countryCode: "IT", countryName: "Italy" },
      { id: 2, countryCode: "DE", countryName: "Germany" },
      { id: 3, countryCode: "IT", countryName: "Italy" },
    ];
    const groups = groupByCountry(items, getCode, getName);

    expect(groups).toHaveLength(2);
    const italy = groups.find(g => g.countryCode === "IT");
    expect(italy?.items).toHaveLength(2);
  });

  it("sorts groups by size descending", () => {
    const items: TestItem[] = [
      { id: 1, countryCode: "DE", countryName: "Germany" },
      { id: 2, countryCode: "IT", countryName: "Italy" },
      { id: 3, countryCode: "IT", countryName: "Italy" },
      { id: 4, countryCode: "IT", countryName: "Italy" },
      { id: 5, countryCode: "DE", countryName: "Germany" },
    ];
    const groups = groupByCountry(items, getCode, getName);

    expect(groups[0].countryCode).toBe("IT");
    expect(groups[0].items).toHaveLength(3);
    expect(groups[1].countryCode).toBe("DE");
    expect(groups[1].items).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(groupByCountry([], getCode, getName)).toEqual([]);
  });

  it("uses '??' for items with falsy country code", () => {
    const items: TestItem[] = [
      { id: 1, countryCode: "", countryName: "Unknown" },
    ];
    const groups = groupByCountry(items, getCode, getName);
    expect(groups[0].countryCode).toBe("??");
  });

  it("uses 'Sconosciuto' for items with falsy country name", () => {
    const items: TestItem[] = [
      { id: 1, countryCode: "XX", countryName: "" },
    ];
    const groups = groupByCountry(items, getCode, getName);
    expect(groups[0].countryName).toBe("Sconosciuto");
  });

  it("preserves all items in the grouped output", () => {
    const items: TestItem[] = [
      { id: 1, countryCode: "IT", countryName: "Italy" },
      { id: 2, countryCode: "DE", countryName: "Germany" },
      { id: 3, countryCode: "FR", countryName: "France" },
      { id: 4, countryCode: "IT", countryName: "Italy" },
    ];
    const groups = groupByCountry(items, getCode, getName);
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(totalItems).toBe(4);
  });

  it("uses the first item's country name for each group", () => {
    const items: TestItem[] = [
      { id: 1, countryCode: "IT", countryName: "Italy" },
      { id: 2, countryCode: "IT", countryName: "Italia" }, // different name, same code
    ];
    const groups = groupByCountry(items, getCode, getName);
    expect(groups[0].countryName).toBe("Italy"); // first encountered name wins
  });

  it("works with a single item", () => {
    const items: TestItem[] = [{ id: 1, countryCode: "IT", countryName: "Italy" }];
    const groups = groupByCountry(items, getCode, getName);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });
});
