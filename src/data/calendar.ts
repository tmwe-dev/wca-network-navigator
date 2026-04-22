/**
 * Data Access Layer — Calendar Events
 * Single source of truth for all calendar_events table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type CalendarEventUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

// ─── Types ──────────────────────────────────────────────
export type EventType = "meeting" | "call" | "task" | "reminder" | "follow_up";
export type EventStatus = "scheduled" | "completed" | "cancelled";
export type RecurrenceType = "daily" | "weekly" | "monthly" | "none";

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  partner_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  location: string | null;
  color: string;
  recurrence: RecurrenceType | null;
  reminder_minutes: number;
  status: EventStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventWithRelations extends CalendarEvent {
  partner?: { company_name: string; country_code: string } | null;
  contact?: { name: string; email: string | null; mobile: string | null } | null;
  deal?: { title: string; stage: string } | null;
}

// ─── Queries ────────────────────────────────────────────

/**
 * List events in a date range for the current user
 */
export async function listEvents(
  userId: string,
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", from)
    .lte("start_at", to)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return data as CalendarEvent[];
}

/**
 * Get a single event by ID
 */
export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw error;
  }

  return data as CalendarEvent;
}

/**
 * Create a new event
 */
export async function createEvent(event: CalendarEventInsert): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from("calendar_events")
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data as CalendarEvent;
}

/**
 * Update an existing event
 */
export async function updateEvent(id: string, updates: CalendarEventUpdate): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from("calendar_events")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as CalendarEvent;
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);

  if (error) throw error;
}

/**
 * Get upcoming events for the current user, limited to N events
 */
export async function getUpcomingEvents(userId: string, limit = 5): Promise<CalendarEvent[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .gte("start_at", now)
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as CalendarEvent[];
}

/**
 * Get events for a specific partner
 */
export async function getEventsForPartner(partnerId: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("status", "scheduled")
    .order("start_at", { ascending: true });

  if (error) throw error;
  return data as CalendarEvent[];
}

/**
 * Get events for a specific deal
 */
export async function getEventsForDeal(dealId: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("deal_id", dealId)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return data as CalendarEvent[];
}

/**
 * Get events for a specific contact
 */
export async function getEventsForContact(contactId: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("contact_id", contactId)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return data as CalendarEvent[];
}

/**
 * Get events by type for current user
 */
export async function getEventsByType(
  userId: string,
  eventType: EventType,
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("status", "scheduled")
    .order("start_at", { ascending: true });

  if (error) throw error;
  return data as CalendarEvent[];
}

// ─── Query Key Generators ──────────────────────────────

export const calendarKeys = {
  all: () => [queryKeys.calendar],
  lists: () => [...calendarKeys.all(), "list"],
  list: (userId: string, from: string, to: string) => [
    ...calendarKeys.lists(),
    userId,
    from,
    to,
  ],
  upcoming: (userId: string) => [queryKeys.calendar, "upcoming", userId],
  detail: () => [...calendarKeys.all(), "detail"],
  byId: (id: string) => [...calendarKeys.detail(), id],
  byPartner: (partnerId: string) => [queryKeys.calendar, "partner", partnerId],
  byDeal: (dealId: string) => [queryKeys.calendar, "deal", dealId],
  byContact: (contactId: string) => [queryKeys.calendar, "contact", contactId],
  byType: (userId: string, type: EventType) => [queryKeys.calendar, "type", userId, type],
};

// ─── Cache Invalidation ─────────────────────────────────

export function invalidateCalendarCache(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: calendarKeys.all() });
}

export function invalidateCalendarList(queryClient: QueryClient, userId: string) {
  queryClient.invalidateQueries({ queryKey: calendarKeys.lists() });
  queryClient.invalidateQueries({ queryKey: calendarKeys.upcoming(userId) });
}

export function invalidateCalendarForPartner(queryClient: QueryClient, partnerId: string) {
  queryClient.invalidateQueries({ queryKey: calendarKeys.byPartner(partnerId) });
  queryClient.invalidateQueries({ queryKey: calendarKeys.all() });
}

export function invalidateCalendarForDeal(queryClient: QueryClient, dealId: string) {
  queryClient.invalidateQueries({ queryKey: calendarKeys.byDeal(dealId) });
  queryClient.invalidateQueries({ queryKey: calendarKeys.all() });
}

export function invalidateCalendarForContact(queryClient: QueryClient, contactId: string) {
  queryClient.invalidateQueries({ queryKey: calendarKeys.byContact(contactId) });
  queryClient.invalidateQueries({ queryKey: calendarKeys.all() });
}
