import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));
vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

import {
  createSuggestion,
  listMySuggestions,
  listPendingForAdmin,
  listApprovedForArchitect,
  listUserPreferences,
  approveSuggestion,
  rejectSuggestion,
  editAndApprove,
  markSuggestionsApplied,
  buildLearnedPatterns,
  countByStatus,
} from "@/data/suggestedImprovements";

describe("DAL — suggestedImprovements (deprecated)", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createSuggestion", () => {
    it("throws because table is deprecated", async () => {
      await expect(
        createSuggestion("u1", {
          source_context: "chat",
          suggestion_type: "user_preference",
          title: "Test",
          content: "Content",
        }),
      ).rejects.toThrow("not available in schema");
    });
  });

  describe("listMySuggestions", () => {
    it("returns empty array", async () => {
      const result = await listMySuggestions("u1");
      expect(result).toEqual([]);
    });
  });

  describe("listPendingForAdmin", () => {
    it("returns empty array", async () => {
      const result = await listPendingForAdmin();
      expect(result).toEqual([]);
    });
  });

  describe("listApprovedForArchitect", () => {
    it("returns empty array", async () => {
      const result = await listApprovedForArchitect();
      expect(result).toEqual([]);
    });
  });

  describe("listUserPreferences", () => {
    it("returns empty array", async () => {
      const result = await listUserPreferences("u1");
      expect(result).toEqual([]);
    });
  });

  describe("approveSuggestion", () => {
    it("throws because table is deprecated", async () => {
      await expect(approveSuggestion("s1", "admin1")).rejects.toThrow("not available in schema");
    });
  });

  describe("rejectSuggestion", () => {
    it("throws because table is deprecated", async () => {
      await expect(rejectSuggestion("s1", "admin1")).rejects.toThrow("not available in schema");
    });
  });

  describe("editAndApprove", () => {
    it("throws because table is deprecated", async () => {
      await expect(editAndApprove("s1", "admin1", "new content")).rejects.toThrow("not available in schema");
    });
  });

  describe("markSuggestionsApplied", () => {
    it("returns early for empty ids", async () => {
      await markSuggestionsApplied([], "run-1");
    });
  });

  describe("buildLearnedPatterns", () => {
    it("returns empty string", async () => {
      const result = await buildLearnedPatterns("u1");
      expect(result).toBe("");
    });
  });

  describe("countByStatus", () => {
    it("returns zero counts", async () => {
      const result = await countByStatus();
      expect(result).toEqual({ pending: 0, approved: 0, rejected: 0, applied: 0 });
    });
  });
});
