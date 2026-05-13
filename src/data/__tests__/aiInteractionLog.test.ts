import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockIn = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockIlike = vi.fn();
const mockFrom = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    auth: { getSession: () => mockGetSession() },
  },
}));

import {
  logAiInteraction,
  listAiInteractions,
  listFeedbackForInteractions,
  _upsertFeedback,
  _deleteFeedback,
} from "@/data/aiInteractionLog";

describe("DAL — aiInteractionLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: () => ({
        eq: (...a: unknown[]) => {
          mockEq(...a);
          return { eq: mockEq };
        },
      }),
    });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, in: mockIn, maybeSingle: mockMaybeSingle });
    mockEq.mockReturnValue({ order: mockOrder, eq: mockEq, maybeSingle: mockMaybeSingle, gte: mockGte });
    mockGte.mockReturnValue({ lte: mockLte });
    mockLte.mockReturnValue({ ilike: mockIlike });
    mockIlike.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: { id: "log1" }, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    mockEq.mockResolvedValue({ error: null });
  });

  describe("logAiInteraction", () => {
    it("inserts and returns id", async () => {
      const result = await logAiInteraction({
        interaction_type: "chat_text",
        role: "user",
        content: "hello",
      });
      expect(result).toBe("log1");
    });

    it("returns null when no session", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      const result = await logAiInteraction({
        interaction_type: "chat_text",
        role: "user",
        content: "test",
      });
      expect(result).toBeNull();
    });

    it("returns null on insert error", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "fail" } });
      const result = await logAiInteraction({
        interaction_type: "chat_text",
        role: "user",
        content: "test",
      });
      expect(result).toBeNull();
    });
  });

  describe("listAiInteractions", () => {
    it("returns interactions list", async () => {
      const rows = [{ id: "i1" }];
      mockLimit.mockResolvedValue({ data: rows, error: null });
      const result = await listAiInteractions();
      expect(result).toEqual(rows);
    });

    it("throws on error", async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(listAiInteractions()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("listFeedbackForInteractions", () => {
    it("returns empty for empty ids", async () => {
      const result = await listFeedbackForInteractions([]);
      expect(result).toEqual([]);
    });

    it("returns feedback rows", async () => {
      const rows = [{ id: "f1", rating: 1 }];
      mockIn.mockResolvedValue({ data: rows, error: null });
      const result = await listFeedbackForInteractions(["i1"]);
      expect(result).toEqual(rows);
    });
  });
});
