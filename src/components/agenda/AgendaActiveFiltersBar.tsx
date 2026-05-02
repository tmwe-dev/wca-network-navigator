/**
 * AgendaActiveFiltersBar — Barra compatta che mostra i filtri attivi come chip,
 * sopra la lista delle attività. Permette di rimuovere un filtro con un click.
 */
import { X } from "lucide-react";
import { format, isToday } from "date-fns";
import { it } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import type { ActivityTypeFilter, ResponseFilter } from "./AgendaCalendarPage";

interface AgendaActiveFiltersBarProps {
  selectedDay: Date;
  filters: { activityType: ActivityTypeFilter; responseStatus: ResponseFilter };
  onResetActivityType: () => void;
  onResetResponse: () => void;
  onResetDay: () => void;
}

const ACTIVITY_LABEL: Record<ActivityTypeFilter, string> = {
  all: "Tutti",
  send_email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  phone_call: "Chiamate",
  note: "Note",
};

const RESPONSE_LABEL: Record<ResponseFilter, string> = {
  all: "Tutti",
  responded: "Ha risposto",
  no_response: "Non ha risposto",
};

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <Badge
      variant="outline"
      className="h-6 gap-1 pl-2 pr-1 text-[10px] font-normal bg-card/40 border-border/40"
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Rimuovi filtro ${label}`}
          className="hover:bg-muted/50 rounded p-0.5"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </Badge>
  );
}

export default function AgendaActiveFiltersBar({
  selectedDay,
  filters,
  onResetActivityType,
  onResetResponse,
  onResetDay,
}: AgendaActiveFiltersBarProps) {
  const dayLabel = isToday(selectedDay)
    ? "Oggi"
    : format(selectedDay, "EEE d MMM", { locale: it });

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-border/30 bg-card/20">
      <Chip label={dayLabel} onRemove={isToday(selectedDay) ? undefined : onResetDay} />
      {filters.activityType !== "all" && (
        <Chip label={ACTIVITY_LABEL[filters.activityType]} onRemove={onResetActivityType} />
      )}
      {filters.responseStatus !== "all" && (
        <Chip label={RESPONSE_LABEL[filters.responseStatus]} onRemove={onResetResponse} />
      )}
    </div>
  );
}