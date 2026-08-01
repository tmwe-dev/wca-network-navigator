/**
 * DAL Partners — Unit tests
 * Verifies the partner DAL API surface and types.
 */
import { describe, it, expect } from "vitest";
import * as partnersDAL from "@/data/partners";

describe("DAL — partners", () => {
  it("exports all expected query functions", () => {
    expect(typeof partnersDAL.findPartners).toBe("function");
    expect(typeof partnersDAL.findPartnersByCountry).toBe("function");
    expect(typeof partnersDAL.getPartner).toBe("function");
    expect(typeof partnersDAL.searchPartners).toBe("function");
    expect(typeof partnersDAL.countActivePartners).toBe("function");
    expect(typeof partnersDAL.getDistinctCountries).toBe("function");
    expect(typeof partnersDAL.getPartnerStats).toBe("function");
  });

  it("exports all expected mutation functions", () => {
    expect(typeof partnersDAL.updatePartner).toBe("function");
    expect(typeof partnersDAL.toggleFavorite).toBe("function");
    expect(typeof partnersDAL.createPartner).toBe("function");
    expect(typeof partnersDAL.deletePartnersByIds).toBe("function");
  });

  it("exports new Phase 1+ DAL functions", () => {
    expect(typeof partnersDAL.findPartnerByWcaId).toBe("function");
    expect(typeof partnersDAL.findPartnerByName).toBe("function");
    expect(typeof partnersDAL.countPartnersWithoutCountry).toBe("function");
    expect(typeof partnersDAL.getPartnersByIds).toBe("function");
    expect(typeof partnersDAL.getWcaIdsByCountries).toBe("function");
  });

  it("exports cache invalidation helper", () => {
    expect(typeof partnersDAL.invalidatePartnerCache).toBe("function");
  });

  it("PartnerFilters interface allows all expected filter keys", () => {
    const filters: partnersDAL.PartnerFilters = {
      search: "test",
      countries: ["IT"],
      cities: ["Milano"],
      partnerTypes: ["freight_forwarder"],
      favorites: true,
    };
    expect(filters.search).toBe("test");
  });
});
