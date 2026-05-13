import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { logAiInteraction, fetchRecentAiInteractions } from "@/data/aiInteractionLog";

describe("DAL — aiInteractionLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert, select: mockSelect });
    mockInsert.mockResolvedValue({ error: null });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe("logAiInteraction", () => {
    it("inserts a log entry", async () => {
      await logAiInteraction({ function_name: "test", scope: "email", ok: true, latency_ms: 100 } as never);
      expect(mockFrom).toHaveBeenCalledWith("ai_interaction_log");
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("fetchRecentAiInteractions", () => {
    it("returns recent logs", async () => {
      const logs = [{ id: "1", function_name: "test" }];
      mockLimit.mockResolvedValue({ data: logs, error: null });
      const result = await fetchRecentAiInteractions(10);
      expect(result).toEqual(logs);
    });
  });
});
