import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

describe("queryKeys", () => {
  it("partners.all is stable", () => {
    expect(queryKeys.partners.all).toEqual(["partners"]);
  });

  it("partners.filtered includes filters", () => {
    const key = queryKeys.partners.filtered({ status: "active" });
    expect(key).toEqual(["partners", { status: "active" }]);
  });

  it("partner(id) produces unique key", () => {
    expect(queryKeys.partner("abc")).toEqual(["partner", "abc"]);
    expect(queryKeys.partner("xyz")).toEqual(["partner", "xyz"]);
  });

  it("directoryCache includes params", () => {
    const key = queryKeys.directoryCache(["IT"], ["wca"]);
    expect(key).toEqual(["directory-cache", ["IT"], ["wca"]]);
  });

  it("countryStats is constant", () => {
    expect(queryKeys.countryStats).toEqual(["country-stats"]);
  });

  it("credits.all is constant", () => {
    expect(queryKeys.credits.all).toEqual(["user-credits"]);
  });
});
