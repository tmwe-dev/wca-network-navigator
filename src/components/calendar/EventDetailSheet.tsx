/**
 * EventDetailSheet Component
 * Detailed view of a calendar event in a sheet
 */
import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Clock,
  MapPin,
  Users,
  Edit,
  Trash2,
  Link as LinkIcon,
  AlertCircle,
} from "lucide-react";
import { useEvent, useUpdateEvent, useDeleteEvent } from "@/hooks/useCalendar";
import { usePartners } from "@/hooks/usePartners";
import { useContacts } from "@/hooks/useContacts";
import { useDeals } from "@/hooks/useDeals";
import type { CalendarEvent, EventType } from "@/data/calendar";
import type { Partner } from "@/data/partners";
import type { Deal } from "@/data/deals";

interface Contact {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface EventDetailSheetProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: CalendarEvent) => void;
}

export function EventDetailSheet({
  eventId,
  open,
  onOpenChange,
  onEdit,
}: EventDetailSheetProps) {
  const { data: event } = useEvent(eventId || "");
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const { data: partners = [] } = usePartners();
  const { data: contacts = [] } = useContacts();
  const { data: deals = [] } = useDeals();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!event) return null;

  const getEventTypeLabel = (type: EventType): string => {
    const labels: Record<EventType, string> = {
      meeting: "Riunione",
      call: "Chiamata",
      task: "Attività",
      reminder: "Promemoria",
      follow_up: "Follow-up",
    };
    return labels[type];
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
      scheduled: { bg: "bg-blue-900", text: "text-blue-100", label: "Programmato" },
      completed: { bg: "bg-green-900", text: "text-green-100", label: "Completato" },
      cancelled: { bg: "bg-red-900", text: "text-red-100", label: "Annullato" },
    };

    const style = statusStyles[status] || statusStyles.scheduled;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const formatDateTime = (dateString: string, allDay: boolean): string => {
    const date = new Date(dateString);
    if (allDay) {
      return date.toLocaleDateString("it-IT");
    }
    return date.toLocaleString("it-IT", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleMarkComplete = async () => {
    await updateEvent.mutateAsync({
      eventId: event.id,
      updates: { status: "completed" },
    });
  };

  const handleDelete = async () => {
    await deleteEvent.mutateAsync(event.id);
    onOpenChange(false);
  };

  const partner = event.partner_id
    ? partners.find((p: Partner) => p.id === event.partner_id)
    : null;
  const contact = event.contact_id
    ? contacts.find((c: Contact) => c.id === event.contact_id)
    : null;
  const deal = event.deal_id ? deals.find((d: Deal) => d.id === event.deal_id) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-gray-900 border-gray-800 text-white">
        <SheetHeader>
          <SheetTitle className="text-white">{event.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Status Badge */}
          <div>{getStatusBadge(event.status)}</div>

          {/* Type and Date */}
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400">Tipo di evento</p>
              <p className="font-medium">{getEventTypeLabel(event.event_type)}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                <span>Data e ora</span>
              </div>
              <p className="font-medium">{formatDateTime(event.start_at, event.all_day)}</p>
              {event.end_at && (
                <p className="text-sm text-gray-400">
                  fino a {formatDateTime(event.end_at, event.all_day)}
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <MapPin className="w-4 h-4" />
                <span>Luogo</span>
              </div>
              <p className="font-medium">{event.location}</p>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <p className="text-sm text-gray-400 mb-1">Descrizione</p>
              <p className="text-sm text-gray-200">{event.description}</p>
            </div>
          )}

          {/* Related Records */}
          <div className="space-y-3 border-t border-gray-800 pt-4">
            {partner && (
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <Users className="w-4 h-4" />
                  <span>Partner</span>
                </div>
                <button
                  onClick={() => {
                    // Navigate to partner detail
                  }}
                  className="font-medium hover:text-blue-400 transition-colors"
                >
                  {partner.company_name}
                </button>
              </div>
            )}

            {contact && (
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <Users className="w-4 h-4" />
                  <span>Contatto</span>
                </div>
                <button
                  onClick={() => {
                    // Navigate to contact detail
                  }}
                  className="font-medium hover:text-blue-400 transition-colors"
                >
                  {contact.name}
                </button>
              </div>
            )}

            {deal && (
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <LinkIcon className="w-4 h-4" />
                  <span>Deal</span>
                </div>
                <button
                  onClick={() => {
                    // Navigate to deal detail
                  }}
                  className="font-medium hover:text-blue-400 transition-colors"
                >
                  {deal.title}
                </button>
              </div>
            )}
          </div>

          {/* Reminder and Recurrence */}
          <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-4 text-sm">
            <div>
              <p className="text-gray-400">Promemoria</p>
              <p className="font-medium">{event.reminder_minutes} minuti prima</p>
            </div>

            {event.recurrence && event.recurrence !== "none" && (
              <div>
                <p className="text-gray-400">Ricorrenza</p>
                <p className="font-medium capitalize">
                  {event.recurrence === "daily"
                    ? "Ogni giorno"
                    : event.recurrence === "weekly"
                      ? "Ogni settimana"
                      : event.recurrence === "monthly"
                        ? "Ogni mese"
                        : event.recurrence}
                </p>
              </div>
            )}
          </div>

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="bg-red-900 border border-red-700 rounded p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-100">Sei sicuro?</p>
                  <p className="text-sm text-red-200 mt-1">
                    Questa azione non può essere annullata.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      variant="outline"
                      className="border-red-700 hover:bg-red-800"
                    >
                      Annulla
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteEvent.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteEvent.isPending ? "Eliminazione..." : "Elimina"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="flex gap-2 pt-4 border-t border-gray-800">
          {event.status === "scheduled" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkComplete}
              disabled={updateEvent.isPending}
              className="border-gray-700 hover:bg-gray-800"
            >
              Segna completato
            </Button>
          )}

          {!showDeleteConfirm && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (onEdit) onEdit(event);
                  onOpenChange(false);
                }}
                className="border-gray-700 hover:bg-gray-800"
              >
                <Edit className="w-4 h-4 mr-1" />
                Modifica
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="border-red-700 hover:bg-red-900 text-red-400"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Elimina
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
