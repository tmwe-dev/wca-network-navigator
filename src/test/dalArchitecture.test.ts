import { describe, it, expect } from "vitest";

/**
 * Tests for the Data Access Layer module structure.
 * Verifies that DAL files export the expected public API.
 */

describe("DAL — src/data/partners", () => {
  it("exports all expected functions", async () => {
    const mod = await import("@/data/partners");
    expect(typeof mod.findPartners).toBe("function");
    expect(typeof mod.findPartnersByCountry).toBe("function");
    expect(typeof mod.getPartner).toBe("function");
    expect(typeof mod.updatePartner).toBe("function");
    expect(typeof mod.toggleFavorite).toBe("function");
    expect(typeof mod.getPartnerStats).toBe("function");
    expect(typeof mod.countActivePartners).toBe("function");
    expect(typeof mod.getDistinctCountries).toBe("function");
    expect(typeof mod.searchPartners).toBe("function");
    expect(typeof mod.invalidatePartnerCache).toBe("function");
  });
});

describe("DAL — src/data/activities", () => {
  it("exports all expected functions", async () => {
    const mod = await import("@/data/activities");
    expect(typeof mod.findActivitiesForPartner).toBe("function");
    expect(typeof mod.findAllActivities).toBe("function");
    expect(typeof mod.createActivities).toBe("function");
    expect(typeof mod.updateActivity).toBe("function");
    expect(typeof mod.deleteActivities).toBe("function");
    expect(typeof mod.invalidateActivityCache).toBe("function");
    expect(mod.activityKeys).toBeDefined();
    expect(mod.activityKeys.all).toEqual(["all-activities"]);
  });
});

describe("DAL — src/data/contacts", () => {
  it("exports all expected functions", async () => {
    const mod = await import("@/data/contacts");
    expect(typeof mod.findContacts).toBe("function");
    expect(typeof mod.findHoldingPatternContacts).toBe("function");
    expect(typeof mod.getHoldingPatternStats).toBe("function");
    expect(typeof mod.getContactFilterOptions).toBe("function");
    expect(typeof mod.findContactInteractions).toBe("function");
    expect(typeof mod.updateLeadStatus).toBe("function");
    expect(typeof mod.createContactInteraction).toBe("function");
    expect(typeof mod.deleteContacts).toBe("function");
    expect(typeof mod.updateContact).toBe("function");
    expect(typeof mod.invalidateContactCache).toBe("function");
    expect(mod.contactKeys).toBeDefined();
  });
});

describe("Hook decomposition — useImportLogs barrel", () => {
  it("re-exports all query hooks", async () => {
    const mod = await import("@/hooks/useImportLogs");
    expect(typeof mod.useImportLogs).toBe("function");
    expect(typeof mod.useImportLog).toBe("function");
    expect(typeof mod.useImportedContacts).toBe("function");
    expect(typeof mod.useImportErrors).toBe("function");
  });

  it("re-exports all mutation hooks", async () => {
    const mod = await import("@/hooks/useImportLogs");
    expect(typeof mod.useCreateImport).toBe("function");
    expect(typeof mod.useProcessImport).toBe("function");
    expect(typeof mod.useToggleContactSelection).toBe("function");
    expect(typeof mod.useTransferToPartners).toBe("function");
    expect(typeof mod.useCreateActivitiesFromImport).toBe("function");
    expect(typeof mod.useAnalyzeImportStructure).toBe("function");
    expect(typeof mod.useFixImportErrors).toBe("function");
    expect(typeof mod.useCreateImportFromParsedRows).toBe("function");
  });

  it("re-exports utility functions", async () => {
    const mod = await import("@/hooks/useImportLogs");
    expect(typeof mod.exportErrorsToCSV).toBe("function");
  });
});

describe("Thin hooks — usePartners", () => {
  it("exports all expected hooks", async () => {
    const mod = await import("@/hooks/usePartners");
    expect(typeof mod.usePartners).toBe("function");
    expect(typeof mod.usePartnersByCountry).toBe("function");
    expect(typeof mod.usePartner).toBe("function");
    expect(typeof mod.useToggleFavorite).toBe("function");
    expect(typeof mod.usePartnerStats).toBe("function");
  });
});

describe("Thin hooks — useActivities", () => {
  it("exports all expected hooks", async () => {
    const mod = await import("@/hooks/useActivities");
    expect(typeof mod.useActivitiesForPartner).toBe("function");
    expect(typeof mod.useCreateActivities).toBe("function");
    expect(typeof mod.useUpdateActivity).toBe("function");
    expect(typeof mod.useAllActivities).toBe("function");
    expect(typeof mod.useContactsForPartners).toBe("function");
    expect(typeof mod.useDeleteActivities).toBe("function");
  });
});

describe("Thin hooks — useContacts", () => {
  it("exports all expected hooks", async () => {
    const mod = await import("@/hooks/useContacts");
    expect(typeof mod.useContacts).toBe("function");
    expect(typeof mod.useContactFilterOptions).toBe("function");
    expect(typeof mod.useHoldingPatternContacts).toBe("function");
    expect(typeof mod.useHoldingPatternStats).toBe("function");
    expect(typeof mod.useContactInteractions).toBe("function");
    expect(typeof mod.useUpdateLeadStatus).toBe("function");
    expect(typeof mod.useCreateContactInteraction).toBe("function");
  });
});
