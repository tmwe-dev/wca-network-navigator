import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUntypedFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: unknown[]) => mockUntypedFrom(...a),
}));
vi.mock("@/lib/queryKeys", () => ({
  queryKeys: { v2: { calendar: { events: ["calendar-events"] } } },
}));

import { fetchCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEventById } from "@/data/calendar";

describe("DAL — calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUntypedFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });
    mockSelect.mockReturnValue({ eq: mockEq, gte: mockGte });
    mockGte.mockReturnValue({ lte: mockLte });
    mockLte.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle, eq: mockEq });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
  });

  describe("fetchCalendarEvents", () => {
    it("returns events for date range", async () => {
      const events = [{ id: "e1", title: "Meeting" }];
      mockOrder.mockResolvedValue({ data: events, error: null });
      const result = await fetchCalendarEvents("2026-01-01", "2026-01-31");
      expect(mockUntypedFrom).toHaveBeenCalledWith("calendar_events");
      expect(result).toEqual(events);
    });

    it("returns empty on null data", async () => {
      mockOrder.mockResolvedValue({ data: null, error: null });
      const result = await fetchCalendarEvents("2026-01-01", "2026-01-31");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(fetchCalendarEvents("a", "b")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getCalendarEventById", () => {
    it("returns event or null", async () => {
      const event = { id: "e1", title: "Call" };
      mockMaybeSingle.mockResolvedValue({ data: event, error: null });
      const result = await getCalendarEventById("e1");
      expect(result).toEqual(event);
    });
  });

  describe("createCalendarEvent", () => {
    it("inserts and returns event", async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: "new" }, error: null });
      mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle });
      const result = await createCalendarEvent({ title: "New", event_type: "meeting", start_at: "2026-01-01", color: "#fff", reminder_minutes: 15, status: "scheduled" } as never);
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("deleteCalendarEvent", () => {
    it("deletes by id", async () => {
      mockEq.mockResolvedValue({ error: null });
      await deleteCalendarEvent("e1");
      expect(mockUntypedFrom).toHaveBeenCalledWith("calendar_events");
    });
  });
});
