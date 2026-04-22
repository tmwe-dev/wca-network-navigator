/**
 * CreateEventDialog Component
 * Form for creating new calendar events
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEvent } from "@/hooks/useCalendar";
import { usePartners } from "@/hooks/usePartners";
import { useContacts } from "@/hooks/useContacts";
import { useDeals } from "@/hooks/useDeals";
import type { EventType, RecurrenceType } from "@/data/calendar";
import type { Partner } from "@/data/partners";
import type { Deal } from "@/data/deals";

interface Contact {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  defaultType?: EventType;
  partnerId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  initialDate,
  defaultType = "meeting",
  partnerId,
  contactId,
  dealId,
}: CreateEventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>(defaultType);
  const [startDate, setStartDate] = useState(
    initialDate?.toISOString().split("T")[0] || "",
  );
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [selectedPartnerId, setSelectedPartnerId] = useState(partnerId || "");
  const [selectedContactId, setSelectedContactId] = useState(contactId || "");
  const [selectedDealId, setSelectedDealId] = useState(dealId || "");

  const createEvent = useCreateEvent();
  const { data: partners = [] } = usePartners();
  const { data: contacts = [] } = useContacts();
  const { data: deals = [] } = useDeals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !startDate) {
      alert("Titolo e data sono obbligatori");
      return;
    }

    const start_at = new Date(`${startDate}T${allDay ? "00:00" : startTime}`).toISOString();
    const end_at = !allDay
      ? new Date(`${startDate}T${endTime}`).toISOString()
      : undefined;

    await createEvent.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      event_type: eventType,
      start_at,
      end_at,
      all_day: allDay,
      location: location.trim() || undefined,
      color,
      recurrence: recurrence !== "none" ? recurrence : undefined,
      reminder_minutes: reminderMinutes,
      partner_id: selectedPartnerId || null,
      contact_id: selectedContactId || null,
      deal_id: selectedDealId || null,
    });

    if (!createEvent.isPending) {
      resetForm();
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEventType(defaultType);
    setStartDate(initialDate?.toISOString().split("T")[0] || "");
    setStartTime("10:00");
    setEndTime("11:00");
    setAllDay(false);
    setLocation("");
    setColor("#3B82F6");
    setRecurrence("none");
    setReminderMinutes(15);
    setSelectedPartnerId(partnerId || "");
    setSelectedContactId(contactId || "");
    setSelectedDealId(dealId || "");
  };

  const eventTypeOptions: { value: EventType; label: string }[] = [
    { value: "meeting", label: "Riunione" },
    { value: "call", label: "Chiamata" },
    { value: "task", label: "Attività" },
    { value: "reminder", label: "Promemoria" },
    { value: "follow_up", label: "Follow-up" },
  ];

  const recurrenceOptions: { value: RecurrenceType; label: string }[] = [
    { value: "none", label: "Una sola volta" },
    { value: "daily", label: "Ogni giorno" },
    { value: "weekly", label: "Ogni settimana" },
    { value: "monthly", label: "Ogni mese" },
  ];

  const colorOptions = [
    "#3B82F6", // Blue
    "#EF4444", // Red
    "#10B981", // Green
    "#F59E0B", // Amber
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white">Nuovo Evento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Titolo *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Riunione con Acme"
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Descrizione
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note sull'evento..."
              rows={3}
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tipo di Evento
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded p-2"
            >
              {eventTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Data *
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">Tutto il giorno</span>
              </label>
            </div>
          </div>

          {/* Time Range */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Ora inizio
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Ora fine
                </label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Luogo
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Es. Sala riunioni A"
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            />
          </div>

          {/* Partner, Contact, Deal */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Partner
              </label>
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded p-2 text-sm"
              >
                <option value="">Nessuno</option>
                {partners.map((p: Partner) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Contatto
              </label>
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded p-2 text-sm"
              >
                <option value="">Nessuno</option>
                {contacts.map((c: Contact) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Deal
              </label>
              <select
                value={selectedDealId}
                onChange={(e) => setSelectedDealId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded p-2 text-sm"
              >
                <option value="">Nessuno</option>
                {deals.map((d: Deal) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurrence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Ricorrenza
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded p-2"
              >
                {recurrenceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Promemoria (minuti)
              </label>
              <Input
                type="number"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Math.max(0, parseInt(e.target.value)))}
                min="0"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Colore
            </label>
            <div className="flex gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    color === c ? "border-white ring-2 ring-offset-2" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              className="border-gray-700"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={createEvent.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createEvent.isPending ? "Creazione..." : "Crea Evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
