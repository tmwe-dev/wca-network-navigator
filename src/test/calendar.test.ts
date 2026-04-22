import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
  getEventsForPartner,
  getEventsForDeal,
  getEventsForContact,
  getEventsByType,
  type CalendarEvent,
} from "@/data/calendar";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    })),
  },
}));

import { supabase } from "@/integrations/supabase/client";

const mockCalendarEvent: CalendarEvent = {
  id: "event-1",
  user_id: "user-1",
  title: "Team Meeting",
  description: "Weekly sync",
  event_type: "meeting",
  start_at: "2024-01-15T10:00:00Z",
  end_at: "2024-01-15T11:00:00Z",
  all_day: false,
  partner_id: "partner-1",
  contact_id: "contact-1",
  deal_id: "deal-1",
  location: "Conference Room A",
  color: "#FF5733",
  recurrence: "weekly",
  reminder_minutes: 15,
  status: "scheduled",
  metadata: null,
  created_at: "2024-01-10T08:00:00Z",
  updated_at: "2024-01-10T08:00:00Z",
};

const mockCalendarEvent2: CalendarEvent = {
  ...mockCalendarEvent,
  id: "event-2",
  title: "Client Call",
  event_type: "call",
  start_at: "2024-01-16T14:00:00Z",
};

describe("Calendar Data Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listEvents", () => {
    it("should fetch events in date range for user", async () => {
      const mockFromFn = vi.fn().mockReturnThis();
      const mockSelectFn = vi.fn().mockReturnThis();
      const mockEqFn = vi.fn().mockReturnThis();
      const mockGteFn = vi.fn().mockReturnThis();
      const mockLteFn = vi.fn().mockReturnThis();
      const mockOrderFn = vi.fn().mockResolvedValueOnce({
        data: [mockCalendarEvent, mockCalendarEvent2],
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: mockSelectFn,
      } as any);
      mockSelectFn.mockReturnValueOnce({ eq: mockEqFn } as any);
      mockEqFn.mockReturnValueOnce({ gte: mockGteFn } as any);
      mockGteFn.mockReturnValueOnce({ lte: mockLteFn } as any);
      mockLteFn.mockReturnValueOnce({ order: mockOrderFn } as any);

      const result = await listEvents("user-1", "2024-01-01", "2024-01-31");

      expect(result).toEqual([mockCalendarEvent, mockCalendarEvent2]);
      expect(supabase.from).toHaveBeenCalledWith("calendar_events");
      expect(mockSelectFn).toHaveBeenCalledWith("*");
    });

    it("should handle empty results", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);
      const mockQuery = vi.mocked(supabase.from)("calendar_events");
      vi.mocked(mockQuery.select).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        gte: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockEqFn.gte).mockReturnValueOnce({
        lte: vi.fn().mockReturnThis(),
      } as any);

      const mockGteFn = vi.mocked(mockEqFn.gte)("start_at", "2024-01-01");
      vi.mocked(mockGteFn.lte).mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
      } as any);

      const result = await listEvents("user-1", "2024-01-01", "2024-01-31");

      expect(result).toEqual([]);
    });

    it("should throw error on database failure", async () => {
      const mockError = new Error("Database error");
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        gte: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockEqFn.gte).mockReturnValueOnce({
        lte: vi.fn().mockReturnThis(),
      } as any);

      const mockGteFn = vi.mocked(mockEqFn.gte)("start_at", "2024-01-01");
      vi.mocked(mockGteFn.lte).mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      await expect(listEvents("user-1", "2024-01-01", "2024-01-31")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("getEvent", () => {
    it("should fetch single event by ID", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: mockCalendarEvent, error: null }),
      } as any);

      const result = await getEvent("event-1");

      expect(result).toEqual(mockCalendarEvent);
    });

    it("should return null for non-existent event", async () => {
      const notFoundError = { code: "PGRST116" };
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: null, error: notFoundError }),
      } as any);

      const result = await getEvent("non-existent");

      expect(result).toBeNull();
    });

    it("should throw error on database failure", async () => {
      const mockError = new Error("Query error");
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      await expect(getEvent("event-1")).rejects.toThrow("Query error");
    });
  });

  describe("createEvent", () => {
    it("should create new event successfully", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
      } as any);

      const mockInsertFn = vi.mocked(supabase.from)("calendar_events").insert([]);
      vi.mocked(mockInsertFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: mockCalendarEvent, error: null }),
      } as any);

      const result = await createEvent({
        user_id: "user-1",
        title: "Team Meeting",
        event_type: "meeting",
        start_at: "2024-01-15T10:00:00Z",
      });

      expect(result).toEqual(mockCalendarEvent);
      expect(supabase.from).toHaveBeenCalledWith("calendar_events");
    });

    it("should throw error on insert failure", async () => {
      const mockError = new Error("Insert failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
      } as any);

      const mockInsertFn = vi.mocked(supabase.from)("calendar_events").insert([]);
      vi.mocked(mockInsertFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      await expect(
        createEvent({
          user_id: "user-1",
          title: "Meeting",
          event_type: "meeting",
          start_at: "2024-01-15T10:00:00Z",
        })
      ).rejects.toThrow("Insert failed");
    });
  });

  describe("updateEvent", () => {
    it("should update event successfully", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("calendar_events").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockUpdateFn.eq)("id", "event-1");
      vi.mocked(mockEqFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({
          data: { ...mockCalendarEvent, title: "Updated Meeting" },
          error: null,
        }),
      } as any);

      const result = await updateEvent("event-1", { title: "Updated Meeting" });

      expect(result.title).toBe("Updated Meeting");
    });

    it("should include updated_at timestamp", async () => {
      const updateCapture: any = {};
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn((data) => {
          Object.assign(updateCapture, data);
          return {
            eq: vi.fn().mockReturnThis(),
          };
        }),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("calendar_events").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockUpdateFn.eq)("id", "event-1");
      vi.mocked(mockEqFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: mockCalendarEvent, error: null }),
      } as any);

      await updateEvent("event-1", { title: "Updated" });

      expect(updateCapture.updated_at).toBeDefined();
    });

    it("should throw error on update failure", async () => {
      const mockError = new Error("Update failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("calendar_events").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockUpdateFn.eq)("id", "event-1");
      vi.mocked(mockEqFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      await expect(updateEvent("event-1", { title: "Updated" })).rejects.toThrow(
        "Update failed"
      );
    });
  });

  describe("deleteEvent", () => {
    it("should delete event successfully", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
      } as any);

      const mockDeleteFn = vi.mocked(supabase.from)("calendar_events").delete();
      vi.mocked(mockDeleteFn.eq).mockResolvedValueOnce({ data: null, error: null });

      await expect(deleteEvent("event-1")).resolves.toBeUndefined();
    });

    it("should throw error on delete failure", async () => {
      const mockError = new Error("Delete failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
      } as any);

      const mockDeleteFn = vi.mocked(supabase.from)("calendar_events").delete();
      vi.mocked(mockDeleteFn.eq).mockResolvedValueOnce({ data: null, error: mockError });

      await expect(deleteEvent("event-1")).rejects.toThrow("Delete failed");
    });
  });

  describe("getUpcomingEvents", () => {
    it("should fetch upcoming scheduled events", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockFirstEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockFirstEqFn.eq).mockReturnValueOnce({
        gte: vi.fn().mockReturnThis(),
      } as any);

      const mockSecondEqFn = vi.mocked(mockFirstEqFn.eq)("status", "scheduled");
      vi.mocked(mockSecondEqFn.gte).mockReturnValueOnce({
        order: vi.fn().mockReturnThis(),
      } as any);

      const mockGteFn = vi.mocked(mockSecondEqFn.gte)("start_at", expect.any(String));
      vi.mocked(mockGteFn.order).mockReturnValueOnce({
        limit: vi.fn().mockResolvedValueOnce({ data: [mockCalendarEvent], error: null }),
      } as any);

      const result = await getUpcomingEvents("user-1", 5);

      expect(result).toEqual([mockCalendarEvent]);
    });

    it("should respect limit parameter", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockFirstEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockFirstEqFn.eq).mockReturnValueOnce({
        gte: vi.fn().mockReturnThis(),
      } as any);

      const mockSecondEqFn = vi.mocked(mockFirstEqFn.eq)("status", "scheduled");
      vi.mocked(mockSecondEqFn.gte).mockReturnValueOnce({
        order: vi.fn().mockReturnThis(),
      } as any);

      const mockGteFn = vi.mocked(mockSecondEqFn.gte)("start_at", expect.any(String));
      const mockOrderFn = vi.mocked(mockGteFn.order)("start_at", { ascending: true });
      vi.mocked(mockOrderFn.limit).mockResolvedValueOnce({ data: [], error: null });

      await getUpcomingEvents("user-1", 10);

      expect(mockOrderFn.limit).toHaveBeenCalledWith(10);
    });

    it("should filter by scheduled status only", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      const mockEqCall = vi.fn().mockReturnThis();
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: mockEqCall,
      } as any);

      await getUpcomingEvents("user-1", 5);

      expect(mockEqCall).toHaveBeenCalledWith("status", "scheduled");
    });
  });

  describe("getEventsForPartner", () => {
    it("should fetch events for specific partner", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockFirstEqFn = vi.mocked(mockSelectFn.eq)("partner_id", "partner-1");
      vi.mocked(mockFirstEqFn.eq).mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({ data: [mockCalendarEvent], error: null }),
      } as any);

      const result = await getEventsForPartner("partner-1");

      expect(result).toEqual([mockCalendarEvent]);
    });

    it("should filter by scheduled status for partner events", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      const statusEqFn = vi.fn().mockReturnThis();
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: statusEqFn,
      } as any);

      await getEventsForPartner("partner-1");

      expect(statusEqFn).toHaveBeenCalledWith("status", "scheduled");
    });
  });

  describe("getEventsForDeal", () => {
    it("should fetch events for specific deal", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({ data: [mockCalendarEvent], error: null }),
      } as any);

      const result = await getEventsForDeal("deal-1");

      expect(result).toEqual([mockCalendarEvent]);
    });

    it("should return empty array on no results", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
      } as any);

      const result = await getEventsForDeal("deal-1");

      expect(result).toEqual([]);
    });
  });

  describe("getEventsForContact", () => {
    it("should fetch events for specific contact", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({ data: [mockCalendarEvent], error: null }),
      } as any);

      const result = await getEventsForContact("contact-1");

      expect(result).toEqual([mockCalendarEvent]);
    });
  });

  describe("getEventsByType", () => {
    it("should fetch events filtered by type", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockFirstEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockFirstEqFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockSecondEqFn = vi.mocked(mockFirstEqFn.eq)("event_type", "meeting");
      vi.mocked(mockSecondEqFn.eq).mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({ data: [mockCalendarEvent], error: null }),
      } as any);

      const result = await getEventsByType("user-1", "meeting");

      expect(result).toEqual([mockCalendarEvent]);
    });

    it("should handle different event types", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("calendar_events").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockFirstEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockFirstEqFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockSecondEqFn = vi.mocked(mockFirstEqFn.eq)("event_type", "call");
      vi.mocked(mockSecondEqFn.eq).mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({ data: [mockCalendarEvent2], error: null }),
      } as any);

      const result = await getEventsByType("user-1", "call");

      expect(result[0].event_type).toBe("call");
    });
  });
});
