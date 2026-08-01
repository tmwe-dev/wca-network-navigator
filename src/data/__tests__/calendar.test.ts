import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
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

/** Row DB minimale: il DAL mappa esplicitamente ogni campo. */
function dbRow(id: string, over: Record<string, any> = {}) {
  return {
    id,
    user_id: "u1",
    title: "T",
    description: null,
    event_type: "meeting",
    start_at: "2026-01-02T10:00:00Z",
    end_at: null,
    all_day: false,
    partner_id: null,
    contact_id: null,
    deal_id: null,
    location: null,
    color: "#3b82f6",
    recurrence: null,
    reminder_minutes: 15,
    status: "scheduled",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function chain(terminal: { data?: any; error?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
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
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — calendar", () => {
  describe("listEvents", () => {
    it("returns events for date range", async () => {
      mockFrom.mockReturnValue(chain({ data: [dbRow("e1")], error: null }));
      const result = await listEvents("u1", "2026-01-01", "2026-01-31");
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "e1", event_type: "meeting", status: "scheduled" });
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listEvents("u1", "a", "b")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getEvent", () => {
    it("returns single event", async () => {
      const c = chain({ data: dbRow("e1"), error: null });
      mockFrom.mockReturnValue(c);
      const result = await getEvent("e1");
      expect(result).toMatchObject({ id: "e1", title: "T" });
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
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: dbRow("new"), error: null });
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
      });
      expect(result).toMatchObject({ id: "new" });
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
      mockFrom.mockReturnValue(chain({ data: [dbRow("e1")], error: null }));
      const result = await getUpcomingEvents("u1");
      expect(result.map((e) => e.id)).toEqual(["e1"]);
    });
  });

  describe("getEventsForPartner", () => {
    it("returns events for partner", async () => {
      mockFrom.mockReturnValue(chain({ data: [dbRow("e2", { partner_id: "p1" })], error: null }));
      const result = await getEventsForPartner("p1");
      expect(result.map((e) => e.id)).toEqual(["e2"]);
    });
  });
});
