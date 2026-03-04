import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Mail, Phone, MessageCircle, Users, Search, Megaphone, StickyNote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ContactInteraction } from "@/hooks/useContacts";

const ICONS: Record<string, typeof Mail> = {
  email_sent: Mail,
  phone_call: Phone,
  whatsapp: MessageCircle,
  meeting: Users,
  deep_search: Search,
  campaign: Megaphone,
  note: StickyNote,
};

const OUTCOME_COLORS: Record<string, string> = {
  positive: "bg-success/20 text-success",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/20 text-destructive",
};

interface Props {
  interactions: ContactInteraction[];
}

export function ContactInteractionTimeline({ interactions }: Props) {
  if (!interactions.length) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Nessuna interazione registrata
      </p>
    );
  }

  return (
    <div className="relative pl-5 space-y-3">
      <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
      {interactions.map((i) => {
        const Icon = ICONS[i.interaction_type] || StickyNote;
        return (
          <div key={i.id} className="relative flex gap-2">
            <div className="absolute -left-5 top-0.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center">
              <Icon className="w-2.5 h-2.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium truncate">{i.title}</span>
                {i.outcome && (
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${OUTCOME_COLORS[i.outcome] ?? ""}`}>
                    {i.outcome === "positive" ? "Positivo" : i.outcome === "negative" ? "Negativo" : "Neutro"}
                  </Badge>
                )}
              </div>
              {i.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{i.description}</p>
              )}
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(i.created_at), "dd MMM yyyy HH:mm", { locale: it })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
