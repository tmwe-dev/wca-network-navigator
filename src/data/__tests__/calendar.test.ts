import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: unknown[]) => mockFrom(...a),
}));
vi.mock("@/lib/queryKeys", () => ({
  queryKeys: { calendar: "calendar" },
}));

import {
  listEvents,
  getEvent,
  createEvent,
  deleteEvent,
  getUpcomingEvents,
  getEventsForPartner,
} from "@/data/calendar";

function chain(terminal: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.gte = vi.fn().mockReturnValue(c);
  c.lte = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue(terminal);
  c.maybeSingle = vi.fn().mockResolvedValue(terminal);
  c.insert = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.delete = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: unknown) => void) => resolve(terminal);
  return c;
}

describe("DAL — calendar", () => {
  describe("listEvents", () => {
    it("returns events for date range", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "e1" }], error: null }));
      const result = await listEvents("u1", "2026-01-01", "2026-01-31");
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(result).toEqual([{ id: "e1" }]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listEvents("u1", "a", "b")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getEvent", () => {
    it("returns single event", async () => {
      const c = chain({ data: { id: "e1" }, error: null });
      mockFrom.mockReturnValue(c);
      const result = await getEvent("e1");
      expect(result).toEqual({ id: "e1" });
    });

    it("returns null when not found", async () => {
      const c = chain();
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "not found" },
      });
      mockFrom.mockReturnValue(c);
      const result = await getEvent("e99");
      expect(result).toBeNull();
    });
  });

  describe("createEvent", () => {
    it("inserts and returns event", async () => {
      const c = chain();
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: "new" }, error: null });
      mockFrom.mockReturnValue(c);
      const result = await createEvent({
        user_id: "u1",
        title: "New",
        event_type: "meeting",
        start_at: "2026-01-01",
        all_day: false,
        color: "#fff",
        reminder_minutes: 15,
        status: "scheduled",
      } as never);
      expect(result).toEqual({ id: "new" });
    });
  });

  describe("deleteEvent", () => {
    it("deletes by id", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await deleteEvent("e1");
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(deleteEvent("e1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getUpcomingEvents", () => {
    it("returns upcoming events", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "e1" }], error: null }));
      const result = await getUpcomingEvents("u1");
      expect(result).toEqual([{ id: "e1" }]);
    });
  });

  describe("getEventsForPartner", () => {
    it("returns events for partner", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "e2" }], error: null }));
      const result = await getEventsForPartner("p1");
      expect(result).toEqual([{ id: "e2" }]);
    });
  });
});
