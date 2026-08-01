import { describe, it, expect } from "vitest";
import { groupByCountry } from "@/lib/groupByCountry";

describe("groupByCountry", () => {
  it("groups items by country and sorts by size descending", () => {
    const items = [
      { country: "IT", countryName: "Italy", name: "a" },
      { country: "US", countryName: "United States", name: "b" },
      { country: "IT", countryName: "Italy", name: "c" },
    ];
    const grouped = groupByCountry(
      items,
      (i) => i.country,
      (i) => i.countryName,
    );
    expect(grouped).toHaveLength(2);
    expect(grouped[0].countryCode).toBe("IT");
    expect(grouped[0].items).toHaveLength(2);
    expect(grouped[1].countryCode).toBe("US");
    expect(grouped[1].items).toHaveLength(1);
  });

  it("handles empty array", () => {
    expect(
      groupByCountry(
        [],
        (_i) => "",
        (_i) => "",
      ),
    ).toEqual([]);
  });

  it("defaults missing code to ?? and missing name to Sconosciuto", () => {
    const items = [{ country: "", countryName: "" }];
    const grouped = groupByCountry(
      items,
      (i) => i.country,
      (i) => i.countryName,
    );
    expect(grouped[0].countryCode).toBe("??");
    expect(grouped[0].countryName).toBe("Sconosciuto");
  });
});
