import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    auth: { getSession: () => mockGetSession() },
  },
}));

import {
  findPendingOutreach,
  findSentOutreach,
  updateActivitySchedule,
  cancelActivity,
  cancelMissionAction,
} from "@/data/outreachPipeline";

function chain(terminal: { data?: unknown; error?: unknown; count?: unknown } = { data: [], error: null }) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockReturnValue(c);
  c.gt = vi.fn().mockReturnValue(c);
  c.gte = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: unknown) => void) => resolve(terminal);
  return c;
}

describe("DAL — outreachPipeline", () => {
  describe("findPendingOutreach", () => {
    it("returns empty when no session", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      const result = await findPendingOutreach();
      expect(result).toEqual({ activities: [], missionActions: [], pendingActions: [] });
    });

    it("returns results when authenticated", async () => {
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
      mockFrom.mockReturnValue(chain({ data: [], error: null }));
      const result = await findPendingOutreach();
      expect(result).toHaveProperty("activities");
      expect(result).toHaveProperty("missionActions");
      expect(result).toHaveProperty("pendingActions");
    });
  });

  describe("findSentOutreach", () => {
    it("returns empty when no session", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      const result = await findSentOutreach();
      expect(result).toEqual({ activities: [], missionActions: [] });
    });
  });

  describe("updateActivitySchedule", () => {
    it("updates scheduled_at", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await updateActivitySchedule("a1", "2026-06-01T10:00:00Z");
      expect(mockFrom).toHaveBeenCalledWith("activities");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(updateActivitySchedule("a1", "x")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("cancelActivity", () => {
    it("cancels activity", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await cancelActivity("a1");
    });
  });

  describe("cancelMissionAction", () => {
    it("cancels mission action", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await cancelMissionAction("m1");
    });
  });
});
