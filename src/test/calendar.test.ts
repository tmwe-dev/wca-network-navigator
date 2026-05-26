import { describe, it, expect, vi, beforeEach } from "vitest";
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

// ─── Mock fns ──────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: any[]) => mockFrom(...a),
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

// ─── Fixtures ──────────────────────────────────────────
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

// ─── Tests ─────────────────────────────────────────────
describe("Calendar Data Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listEvents ───────────────────────────────────────
  // Chain: untypedFrom("calendar_events").select("*").eq("user_id", userId).gte("start_at", from).lte("start_at", to).order("start_at", { ascending: true })
  describe("listEvents", () => {
    function setupListChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ gte: mockGte });
      mockGte.mockReturnValue({ lte: mockLte });
      mockLte.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue(resolvedValue);
    }

    it("should fetch events in date range for user", async () => {
      setupListChain({ data: [mockCalendarEvent, mockCalendarEvent2], error: null });

      const result = await listEvents("user-1", "2024-01-01", "2024-01-31");

      expect(result).toEqual([mockCalendarEvent, mockCalendarEvent2]);
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockGte).toHaveBeenCalledWith("start_at", "2024-01-01");
      expect(mockLte).toHaveBeenCalledWith("start_at", "2024-01-31");
      expect(mockOrder).toHaveBeenCalledWith("start_at", { ascending: true });
    });

    it("should handle empty results", async () => {
      setupListChain({ data: [], error: null });

      const result = await listEvents("user-1", "2024-01-01", "2024-01-31");

      expect(result).toEqual([]);
    });

    it("should throw error on database failure", async () => {
      const mockError = new Error("Database error");
      setupListChain({ data: null, error: mockError });

      await expect(listEvents("user-1", "2024-01-01", "2024-01-31")).rejects.toThrow("Database error");
    });
  });

  // ── getEvent ─────────────────────────────────────────
  // Chain: untypedFrom("calendar_events").select("*").eq("id", id).single()
  describe("getEvent", () => {
    function setupGetChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue(resolvedValue);
    }

    it("should fetch single event by ID", async () => {
      setupGetChain({ data: mockCalendarEvent, error: null });

      const result = await getEvent("event-1");

      expect(result).toEqual(mockCalendarEvent);
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("id", "event-1");
    });

    it("should return null for non-existent event", async () => {
      setupGetChain({ data: null, error: { code: "PGRST116" } });

      const result = await getEvent("non-existent");

      expect(result).toBeNull();
    });

    it("should throw error on database failure", async () => {
      const mockError = new Error("Query error");
      setupGetChain({ data: null, error: mockError });

      await expect(getEvent("event-1")).rejects.toThrow("Query error");
    });
  });

  // ── createEvent ──────────────────────────────────────
  // Chain: untypedFrom("calendar_events").insert(event).select().single()
  describe("createEvent", () => {
    function setupCreateChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ insert: mockInsert });
      mockInsert.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue(resolvedValue);
    }

    it("should create new event successfully", async () => {
      setupCreateChain({ data: mockCalendarEvent, error: null });

      const result = await createEvent({
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
      });

      expect(result).toEqual(mockCalendarEvent);
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
    });

    it("should throw error on insert failure", async () => {
      const mockError = new Error("Insert failed");
      setupCreateChain({ data: null, error: mockError });

      await expect(
        createEvent({
          user_id: "user-1",
          title: "Meeting",
          description: null,
          event_type: "meeting",
          start_at: "2024-01-15T10:00:00Z",
          end_at: null,
          all_day: false,
          partner_id: null,
          contact_id: null,
          deal_id: null,
          location: null,
          color: "#FF5733",
          recurrence: "none",
          reminder_minutes: 15,
          status: "scheduled",
          metadata: null,
        }),
      ).rejects.toThrow("Insert failed");
    });
  });

  // ── updateEvent ──────────────────────────────────────
  // Chain: untypedFrom("calendar_events").update({...}).eq("id", id).select().single()
  describe("updateEvent", () => {
    function setupUpdateChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ update: mockUpdate });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue(resolvedValue);
    }

    it("should update event successfully", async () => {
      setupUpdateChain({
        data: { ...mockCalendarEvent, title: "Updated Meeting" },
        error: null,
      });

      const result = await updateEvent("event-1", { title: "Updated Meeting" });

      expect(result.title).toBe("Updated Meeting");
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockEq).toHaveBeenCalledWith("id", "event-1");
    });

    it("should include updated_at timestamp", async () => {
      setupUpdateChain({ data: mockCalendarEvent, error: null });

      await updateEvent("event-1", { title: "Updated" });

      // The update call should include an updated_at field
      const updateArg = mockUpdate.mock.calls[0][0];
      expect(updateArg.updated_at).toBeDefined();
      expect(updateArg.title).toBe("Updated");
    });

    it("should throw error on update failure", async () => {
      const mockError = new Error("Update failed");
      setupUpdateChain({ data: null, error: mockError });

      await expect(updateEvent("event-1", { title: "Updated" })).rejects.toThrow("Update failed");
    });
  });

  // ── deleteEvent ──────────────────────────────────────
  // Chain: untypedFrom("calendar_events").delete().eq("id", id)
  describe("deleteEvent", () => {
    function setupDeleteChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ delete: mockDelete });
      mockDelete.mockReturnValue({ eq: mockEq });
      mockEq.mockResolvedValue(resolvedValue);
    }

    it("should delete event successfully", async () => {
      setupDeleteChain({ data: null, error: null });

      await expect(deleteEvent("event-1")).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockEq).toHaveBeenCalledWith("id", "event-1");
    });

    it("should throw error on delete failure", async () => {
      const mockError = new Error("Delete failed");
      setupDeleteChain({ data: null, error: mockError });

      await expect(deleteEvent("event-1")).rejects.toThrow("Delete failed");
    });
  });

  // ── getUpcomingEvents ────────────────────────────────
  // Chain: untypedFrom("calendar_events").select("*").eq("user_id", userId).eq("status", "scheduled").gte("start_at", now).order("start_at", { ascending: true }).limit(limit)
  describe("getUpcomingEvents", () => {
    const mockEq2 = vi.fn();
    const mockEq3 = vi.fn();

    function setupUpcomingChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockEq2.mockReturnValue({ gte: mockGte });
      mockGte.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockLimit.mockResolvedValue(resolvedValue);
    }

    beforeEach(() => {
      mockEq2.mockReset();
      mockEq3.mockReset();
    });

    it("should fetch upcoming scheduled events", async () => {
      setupUpcomingChain({ data: [mockCalendarEvent], error: null });

      const result = await getUpcomingEvents("user-1", 5);

      expect(result).toEqual([mockCalendarEvent]);
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockEq2).toHaveBeenCalledWith("status", "scheduled");
      expect(mockGte).toHaveBeenCalledWith("start_at", expect.any(String));
      expect(mockOrder).toHaveBeenCalledWith("start_at", { ascending: true });
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it("should respect limit parameter", async () => {
      setupUpcomingChain({ data: [], error: null });

      await getUpcomingEvents("user-1", 10);

      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it("should filter by scheduled status only", async () => {
      setupUpcomingChain({ data: [], error: null });

      await getUpcomingEvents("user-1", 5);

      expect(mockEq2).toHaveBeenCalledWith("status", "scheduled");
    });
  });

  // ── getEventsForPartner ──────────────────────────────
  // Chain: untypedFrom("calendar_events").select("*").eq("partner_id", partnerId).eq("status", "scheduled").order("start_at", { ascending: true })
  describe("getEventsForPartner", () => {
    const mockEq2 = vi.fn();

    function setupPartnerChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockEq2.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue(resolvedValue);
    }

    beforeEach(() => {
      mockEq2.mockReset();
    });

    it("should fetch events for specific partner", async () => {
      setupPartnerChain({ data: [mockCalendarEvent], error: null });

      const result = await getEventsForPartner("partner-1");

      expect(result).toEqual([mockCalendarEvent]);
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockEq).toHaveBeenCalledWith("partner_id", "partner-1");
    });

    it("should filter by scheduled status for partner events", async () => {
      setupPartnerChain({ data: [mockCalendarEvent], error: null });

      await getEventsForPartner("partner-1");

      expect(mockEq2).toHaveBeenCalledWith("status", "scheduled");
    });
  });

  // ── getEventsForDeal ─────────────────────────────────
  // Chain: untypedFrom("calendar_events").select("*").eq("deal_id", dealId).order("start_at", { ascending: true })
  describe("getEventsForDeal", () => {
    function setupDealChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue(resolvedValue);
    }

    it("should fetch events for specific deal", async () => {
      setupDealChain({ data: [mockCalendarEvent], error: null });

      const result = await getEventsForDeal("deal-1");

      expect(result).toEqual([mockCalendarEvent]);
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockEq).toHaveBeenCalledWith("deal_id", "deal-1");
    });

    it("should return empty array on no results", async () => {
      setupDealChain({ data: [], error: null });

      const result = await getEventsForDeal("deal-1");

      expect(result).toEqual([]);
    });
  });

  // ── getEventsForContact ──────────────────────────────
  // Chain: untypedFrom("calendar_events").select("*").eq("contact_id", contactId).order("start_at", { ascending: true })
  describe("getEventsForContact", () => {
    function setupContactChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue(resolvedValue);
    }

    it("should fetch events for specific contact", async () => {
      setupContactChain({ data: [mockCalendarEvent], error: null });

      const result = await getEventsForContact("contact-1");

      expect(result).toEqual([mockCalendarEvent]);
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockEq).toHaveBeenCalledWith("contact_id", "contact-1");
    });
  });

  // ── getEventsByType ──────────────────────────────────
  // Chain: untypedFrom("calendar_events").select("*").eq("user_id", userId).eq("event_type", eventType).eq("status", "scheduled").order("start_at", { ascending: true })
  describe("getEventsByType", () => {
    const mockEq2 = vi.fn();
    const mockEq3 = vi.fn();

    function setupTypeChain(resolvedValue: { data: any; error: any }) {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockEq2.mockReturnValue({ eq: mockEq3 });
      mockEq3.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue(resolvedValue);
    }

    beforeEach(() => {
      mockEq2.mockReset();
      mockEq3.mockReset();
    });

    it("should fetch events filtered by type", async () => {
      setupTypeChain({ data: [mockCalendarEvent], error: null });

      const result = await getEventsByType("user-1", "meeting");

      expect(result).toEqual([mockCalendarEvent]);
      expect(mockFrom).toHaveBeenCalledWith("calendar_events");
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockEq2).toHaveBeenCalledWith("event_type", "meeting");
      expect(mockEq3).toHaveBeenCalledWith("status", "scheduled");
      expect(mockOrder).toHaveBeenCalledWith("start_at", { ascending: true });
    });

    it("should handle different event types", async () => {
      setupTypeChain({ data: [mockCalendarEvent2], error: null });

      const result = await getEventsByType("user-1", "call");

      expect(result[0].event_type).toBe("call");
      expect(mockEq2).toHaveBeenCalledWith("event_type", "call");
    });
  });
});
