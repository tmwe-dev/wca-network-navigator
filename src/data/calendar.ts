/**
 * Data Access Layer — Calendar Events
 * Single source of truth for all calendar_events table queries.
 */
import { queryKeys } from "@/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CalendarEventDbRow = Database["public"]["Tables"]["calendar_events"]["Row"];

type Json = Database["public"]["Tables"]["calendar_events"]["Row"]["metadata"];
type DbInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type DbUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

/** Metadata è esposto come oggetto tipizzato all'esterno, serializzato a Json in scrittura. */
export type CalendarEventInsert = Omit<DbInsert, "metadata"> & {
  metadata?: Record<string, unknown> | null;
};
export type CalendarEventUpdate = Omit<DbUpdate, "metadata"> & {
  metadata?: Record<string, unknown> | null;
};

function toJson(value: Record<string, unknown> | null | undefined): Json {
  if (value === null || value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

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

// ─── Row mapping (nessun cast: narrowing esplicito) ─────

const EVENT_TYPES: readonly EventType[] = ["meeting", "call", "task", "reminder", "follow_up"];
const EVENT_STATUSES: readonly EventStatus[] = ["scheduled", "completed", "cancelled"];
const RECURRENCES: readonly RecurrenceType[] = ["daily", "weekly", "monthly", "none"];

function toEventType(value: string): EventType {
  return EVENT_TYPES.find((t) => t === value) ?? "task";
}

function toEventStatus(value: string | null): EventStatus {
  return EVENT_STATUSES.find((s) => s === value) ?? "scheduled";
}

function toRecurrence(value: string | null): RecurrenceType | null {
  return RECURRENCES.find((r) => r === value) ?? null;
}

function toMetadata(value: CalendarEventDbRow["metadata"]): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function mapEvent(row: CalendarEventDbRow): CalendarEvent {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    event_type: toEventType(row.event_type),
    start_at: row.start_at,
    end_at: row.end_at,
    all_day: row.all_day ?? false,
    partner_id: row.partner_id,
    contact_id: row.contact_id,
    deal_id: row.deal_id,
    location: row.location,
    color: row.color ?? "#3b82f6",
    recurrence: toRecurrence(row.recurrence),
    reminder_minutes: row.reminder_minutes ?? 0,
    status: toEventStatus(row.status),
    metadata: toMetadata(row.metadata),
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

// ─── Queries ────────────────────────────────────────────

/**
 * List events in a date range for the current user
 */
export async function listEvents(userId: string, from: string, to: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", from)
    .lte("start_at", to)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

/**
 * Get a single event by ID
 */
export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const { data, error } = await supabase.from("calendar_events").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw error;
  }

  return mapEvent(data);
}

/**
 * Create a new event
 */
export async function createEvent(event: CalendarEventInsert): Promise<CalendarEvent> {
  const { metadata, ...rest } = event;
  const payload: DbInsert = metadata === undefined ? rest : { ...rest, metadata: toJson(metadata) };
  const { data, error } = await supabase.from("calendar_events").insert(payload).select().single();

  if (error) throw error;
  return mapEvent(data);
}

/**
 * Update an existing event
 */
export async function updateEvent(id: string, updates: CalendarEventUpdate): Promise<CalendarEvent> {
  const { metadata, ...rest } = updates;
  const patch: DbUpdate = metadata === undefined ? rest : { ...rest, metadata: toJson(metadata) };
  const { data, error } = await supabase
    .from("calendar_events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapEvent(data);
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
  return (data ?? []).map(mapEvent);
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
  return (data ?? []).map(mapEvent);
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
  return (data ?? []).map(mapEvent);
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
  return (data ?? []).map(mapEvent);
}

/**
 * Get events by type for current user
 */
export async function getEventsByType(userId: string, eventType: EventType): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("status", "scheduled")
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

// ─── Query Key Generators ──────────────────────────────

export const calendarKeys = {
  all: () => [queryKeys.calendar],
  lists: () => [...calendarKeys.all(), "list"],
  list: (userId: string, from: string, to: string) => [...calendarKeys.lists(), userId, from, to],
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
