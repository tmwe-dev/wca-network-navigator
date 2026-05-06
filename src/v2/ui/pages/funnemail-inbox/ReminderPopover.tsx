/**
 * ReminderPopover — UI per impostare/dismissare un reminder su una mail.
 * Logic-less: riceve callback dal parent, niente DAL diretto.
 */
import * as React from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FunnemailReminderRow } from "@/data/funnemailReminders";

interface Props {
  onCreate: (remindAt: Date, note?: string) => void;
  existing?: FunnemailReminderRow | null;
  onDismiss?: (id: string) => void;
}

function nextWorkingDayAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Skip Sat/Sun → lunedì
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function nextMondayAt(hour: number): Date {
  const d = new Date();
  const days = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const PRESETS: Array<{ label: string; build: () => Date }> = [
  { label: "Tra 1 ora", build: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: "Tra 4 ore", build: () => new Date(Date.now() + 4 * 60 * 60 * 1000) },
  { label: "Domani 09:00", build: () => nextWorkingDayAt(9) },
  { label: "Lunedì 09:00", build: () => nextMondayAt(9) },
];

export function ReminderPopover({ onCreate, existing, onDismiss }: Props) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [custom, setCustom] = React.useState<string>("");

  const apply = (d: Date) => {
    onCreate(d, note.trim() || undefined);
    setOpen(false);
    setNote("");
    setCustom("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          title={existing ? "Modifica reminder" : "Imposta reminder"}
        >
          <Bell className="h-3.5 w-3.5" />
          {existing ? "Reminder" : "Ricordamelo"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="text-sm font-medium">Imposta reminder</div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => apply(p.build())}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="reminder-custom" className="text-xs">Custom</Label>
          <input
            id="reminder-custom"
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reminder-note" className="text-xs">Nota (opzionale)</Label>
          <Textarea
            id="reminder-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="es. ricontatta quando arriva il listino"
            className="text-xs"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          {existing && onDismiss ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={() => {
                onDismiss(existing.id);
                setOpen(false);
              }}
            >
              <BellOff className="h-3.5 w-3.5" />Rimuovi
            </Button>
          ) : <span />}
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!custom}
            onClick={() => {
              if (!custom) return;
              const d = new Date(custom);
              if (Number.isNaN(d.getTime())) return;
              apply(d);
            }}
          >
            Imposta
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}