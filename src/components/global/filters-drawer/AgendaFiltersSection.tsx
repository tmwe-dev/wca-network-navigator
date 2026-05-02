import { Search, Zap, Calendar as CalendarIcon, Mail, MessageCircle, Linkedin, Phone, StickyNote, MessageSquare, ListTodo } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useReminders } from "@/hooks/useReminders";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { ATTIVITA_PRIORITY } from "./constants";
import { useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek, isToday, parseISO,
} from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS = [
  { value: "all", label: "Tutti", icon: Mail },
  { value: "send_email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "phone_call", label: "Chiamate", icon: Phone },
  { value: "note", label: "Note", icon: StickyNote },
];

const RESPONSE_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "responded", label: "Ha risposto" },
  { value: "no_response", label: "Non ha risposto" },
];

function MiniCalendar() {
  const g = useGlobalFilters();
  const { data: reminders } = useReminders();
  const selectedDays = g.filters.agendaDays;
  const selectedSet = useMemo(() => new Set(selectedDays), [selectedDays]);
  const anchorDay = selectedDays[0] ? parseISO(selectedDays[0]) : new Date();
  const [currentMonth, setCurrentMonth] = useState<Date>(anchorDay);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getRemindersCount = (day: Date) =>
    reminders?.filter((r) => isSameDay(new Date(r.due_date), day)).length || 0;

  const toggleDay = (d: Date) => {
    const key = format(d, "yyyy-MM-dd");
    const next = selectedSet.has(key)
      ? selectedDays.filter(x => x !== key)
      : [...selectedDays, key].sort();
    g.setFilter("agendaDays", next);
  };
  const goToday = () => {
    setCurrentMonth(new Date());
    g.setFilter("agendaDays", [format(new Date(), "yyyy-MM-dd")]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold capitalize text-foreground">
          {format(currentMonth, "MMMM yyyy", { locale: it })}
        </h4>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Mese precedente">
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={goToday}>
            Oggi
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Mese successivo">
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px mb-1">
        {["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"].map((d) => (
          <div key={d} className="text-center text-[9px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const isSelected = selectedSet.has(key) || (selectedDays.length === 0 && isToday(day));
          const isCurrent = isSameMonth(day, currentMonth);
          const count = getRemindersCount(day);
          return (
            <button
              key={day.toISOString()}
                onClick={() => toggleDay(day)}
              className={cn(
                "relative flex flex-col items-center py-1.5 rounded-md transition-all text-[11px]",
                !isCurrent && "opacity-30",
                isSelected && "bg-primary text-primary-foreground shadow-sm",
                !isSelected && isToday(day) && "bg-accent text-accent-foreground",
                !isSelected && !isToday(day) && "hover:bg-muted/50",
              )}
            >
              <span className="font-medium">{format(day, "d")}</span>
              {count > 0 && (
                <div className={cn("w-1 h-1 rounded-full mt-0.5", isSelected ? "bg-primary-foreground" : "bg-primary")} />
              )}
            </button>
          );
        })}
      </div>
      {selectedDays.length > 1 && (
        <p className="text-[9px] text-muted-foreground mt-2 text-center">
          {selectedDays.length} giorni selezionati · click per togliere
        </p>
      )}
    </div>
  );
}

export function AgendaFiltersSection() {
  const g = useGlobalFilters();

  return (
    <>
      <FilterSection icon={CalendarIcon} label="Giorno">
        <MiniCalendar />
      </FilterSection>

      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca attività, evento..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>

      <FilterSection icon={MessageSquare} label="Canale">
        <ChipGroup>
          {CHANNEL_OPTIONS.map(o => (
            <Chip key={o.value} active={g.filters.agendaChannel === o.value} onClick={() => g.setFilter("agendaChannel", o.value)}>
              {o.label}
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      <FilterSection icon={ListTodo} label="Stato risposta">
        <ChipGroup>
          {RESPONSE_OPTIONS.map(o => (
            <Chip key={o.value} active={g.filters.agendaResponse === o.value} onClick={() => g.setFilter("agendaResponse", o.value)}>
              {o.label}
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      <FilterSection icon={Zap} label="Priorità">
        <ChipGroup>{ATTIVITA_PRIORITY.map(o => <Chip key={o.value} active={g.filters.agendaPriority === o.value} onClick={() => g.setAgendaPriority(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
    </>
  );
}
