/**
 * Custom hook for calendar operations
 * Wraps React Query with calendar-specific functionality
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "./use-toast";
import * as calendarData from "@/data/calendar";
import type {
  CalendarEvent,
  EventType,
  RecurrenceType,
  EventStatus,
} from "@/data/calendar";

// ─── useCalendarEvents Hook ──────────────────────────────

export function useCalendarEvents(
  from: string,
  to: string,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: calendarData.calendarKeys.list(user?.id || "", from, to),
    queryFn: () => {
      if (!user?.id) return [];
      return calendarData.listEvents(user.id, from, to);
    },
    enabled: !!user?.id,
  });
}

// ─── useUpcomingEvents Hook ──────────────────────────────

export function useUpcomingEvents(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: calendarData.calendarKeys.upcoming(user?.id || ""),
    queryFn: () => {
      if (!user?.id) return [];
      return calendarData.getUpcomingEvents(user.id, limit);
    },
    enabled: !!user?.id,
  });
}

// ─── useEvent Hook ──────────────────────────────────────

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: calendarData.calendarKeys.byId(eventId),
    queryFn: () => calendarData.getEvent(eventId),
    enabled: !!eventId,
  });
}

// ─── useCreateEvent Hook ────────────────────────────────

interface CreateEventInput {
  title: string;
  description?: string;
  event_type: EventType;
  start_at: string;
  end_at?: string;
  all_day?: boolean;
  partner_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  location?: string;
  color?: string;
  recurrence?: RecurrenceType;
  reminder_minutes?: number;
  metadata?: Record<string, unknown>;
}

export function useCreateEvent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      if (!user?.id) throw new Error("User not authenticated");

      const event = await calendarData.createEvent({
        user_id: user.id,
        ...input,
        description: input.description ?? null,
        color: input.color || "#3B82F6",
        reminder_minutes: input.reminder_minutes ?? 15,
        status: "scheduled" as const,
      } as any);

      return event;
    },
    onSuccess: (event) => {
      calendarData.invalidateCalendarList(queryClient, user?.id || "");
      toast({
        title: "Evento creato",
        description: `${event.title} è stato aggiunto al calendario`,
      });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile creare l'evento",
        variant: "destructive",
      });
    },
  });
}

// ─── useUpdateEvent Hook ────────────────────────────────

interface UpdateEventInput {
  title?: string;
  description?: string;
  event_type?: EventType;
  start_at?: string;
  end_at?: string | null;
  all_day?: boolean;
  partner_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  location?: string;
  color?: string;
  recurrence?: RecurrenceType | null;
  reminder_minutes?: number;
  status?: EventStatus;
  metadata?: Record<string, unknown>;
}

export function useUpdateEvent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { eventId: string; updates: UpdateEventInput }) => {
      const event = await calendarData.updateEvent(input.eventId, input.updates);
      return event;
    },
    onSuccess: (event) => {
      calendarData.invalidateCalendarList(queryClient, user?.id || "");
      queryClient.invalidateQueries({ queryKey: calendarData.calendarKeys.byId(event.id) });
      toast({
        title: "Evento aggiornato",
        description: `${event.title} è stato modificato`,
      });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile aggiornare l'evento",
        variant: "destructive",
      });
    },
  });
}

// ─── useDeleteEvent Hook ────────────────────────────────

export function useDeleteEvent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      await calendarData.deleteEvent(eventId);
      return eventId;
    },
    onSuccess: () => {
      calendarData.invalidateCalendarList(queryClient, user?.id || "");
      toast({
        title: "Evento eliminato",
        description: "L'evento è stato rimosso dal calendario",
      });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile eliminare l'evento",
        variant: "destructive",
      });
    },
  });
}

// ─── useEventsForPartner Hook ──────────────────────────

export function useEventsForPartner(partnerId: string | null) {
  return useQuery({
    queryKey: calendarData.calendarKeys.byPartner(partnerId || ""),
    queryFn: () => (partnerId ? calendarData.getEventsForPartner(partnerId) : []),
    enabled: !!partnerId,
  });
}

// ─── useEventsForDeal Hook ────────────────────────────

export function useEventsForDeal(dealId: string | null) {
  return useQuery({
    queryKey: calendarData.calendarKeys.byDeal(dealId || ""),
    queryFn: () => (dealId ? calendarData.getEventsForDeal(dealId) : []),
    enabled: !!dealId,
  });
}

// ─── useEventsForContact Hook ──────────────────────────

export function useEventsForContact(contactId: string | null) {
  return useQuery({
    queryKey: calendarData.calendarKeys.byContact(contactId || ""),
    queryFn: () => (contactId ? calendarData.getEventsForContact(contactId) : []),
    enabled: !!contactId,
  });
}

// ─── useEventsByType Hook ──────────────────────────────

export function useEventsByType(eventType: EventType) {
  const { user } = useAuth();

  return useQuery({
    queryKey: calendarData.calendarKeys.byType(user?.id || "", eventType),
    queryFn: () => {
      if (!user?.id) return [];
      return calendarData.getEventsByType(user.id, eventType);
    },
    enabled: !!user?.id,
  });
}
