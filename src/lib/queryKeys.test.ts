import { describe, it, expect } from "vitest";
import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  describe("partners", () => {
    it("returns base key for all partners", () => {
      expect(queryKeys.partners.all).toEqual(["partners"]);
    });

    it("returns filtered key with filters object", () => {
      const filters = { country: "IT", rating: 5 };
      expect(queryKeys.partners.filtered(filters)).toEqual(["partners", filters]);
    });

    it("returns filtered key without filters", () => {
      expect(queryKeys.partners.filtered()).toEqual(["partners", undefined]);
    });
  });

  describe("partner", () => {
    it("returns key with partner id", () => {
      expect(queryKeys.partner("abc-123")).toEqual(["partner", "abc-123"]);
    });
  });

  describe("static keys", () => {
    it("returns correct countryStats key", () => {
      expect(queryKeys.countryStats).toEqual(["country-stats"]);
    });

    it("returns correct partnerStats key", () => {
      expect(queryKeys.partnerStats).toEqual(["partner-stats"]);
    });

    it("returns correct downloadJobs key", () => {
      expect(queryKeys.downloadJobs).toEqual(["download-jobs"]);
    });

    it("returns correct userCredits key", () => {
      expect(queryKeys.userCredits).toEqual(["user-credits"]);
    });

    it("returns correct sortingJobs key", () => {
      expect(queryKeys.sortingJobs).toEqual(["sorting-jobs"]);
    });

    it("returns correct allActivities key", () => {
      expect(queryKeys.allActivities).toEqual(["all-activities"]);
    });

    it("returns correct cacheDataByCountry key", () => {
      expect(queryKeys.cacheDataByCountry).toEqual(["cache-data-by-country"]);
    });
  });

  describe("directoryCache", () => {
    it("includes country codes and network keys", () => {
      const result = queryKeys.directoryCache(["IT", "DE"], ["wca", "pca"]);
      expect(result).toEqual(["directory-cache", ["IT", "DE"], ["wca", "pca"]]);
    });

    it("handles empty arrays", () => {
      expect(queryKeys.directoryCache([], [])).toEqual(["directory-cache", [], []]);
    });
  });

  describe("dbPartnersForCountries", () => {
    it("includes country codes", () => {
      expect(queryKeys.dbPartnersForCountries(["IT", "DE"])).toEqual([
        "db-partners-for-countries",
        ["IT", "DE"],
      ]);
    });
  });

  describe("noProfileWcaIds", () => {
    it("includes country codes", () => {
      expect(queryKeys.noProfileWcaIds(["US"])).toEqual(["no-profile-wca-ids", ["US"]]);
    });
  });
});
