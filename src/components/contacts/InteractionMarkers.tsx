import { memo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Mail, Phone, MessageCircle, Users, Search, Megaphone, StickyNote } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Mail> = {
  email_sent: Mail,
  phone_call: Phone,
  whatsapp: MessageCircle,
  meeting: Users,
  deep_search: Search,
  campaign: Megaphone,
  note: StickyNote,
};

const OUTCOME_DOT: Record<string, string> = {
  positive: "bg-emerald-400",
  negative: "bg-destructive",
  neutral: "bg-muted-foreground",
};

export interface InteractionMarker {
  id: string;
  interaction_type: string;
  title: string;
  outcome: string | null;
  created_at: string;
}

interface Props {
  markers: InteractionMarker[];
  maxVisible?: number;
  className?: string;
}

export const InteractionMarkers = memo(function InteractionMarkers({
  markers,
  maxVisible = 8,
  className,
}: Props) {
  if (!markers.length) return null;

  const visible = markers.slice(0, maxVisible);
  const overflow = markers.length - maxVisible;

  return (
    <div className={cn("flex items-center gap-0.5 flex-wrap", className)}>
      {visible.map((m) => {
        const Icon = ICONS[m.interaction_type] || StickyNote;
        const d = new Date(m.created_at);
        const label = format(d, "dd/MM", { locale: it });
        const dotColor = m.outcome ? OUTCOME_DOT[m.outcome] || "bg-muted-foreground" : undefined;

        return (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 text-[8px] font-medium px-1 py-0 rounded bg-muted/60 text-muted-foreground border border-border/30 cursor-default">
                <Icon className="w-2 h-2 shrink-0" />
                {label}
                {dotColor && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] max-w-[200px]">
              <p className="font-medium">{m.title}</p>
              <p className="text-muted-foreground">{format(d, "dd MMM yyyy HH:mm", { locale: it })}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {overflow > 0 && (
        <span className="text-[8px] text-muted-foreground/60">+{overflow}</span>
      )}
    </div>
  );
});
