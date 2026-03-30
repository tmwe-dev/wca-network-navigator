import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Mail, Phone, Users, RotateCcw, StickyNote, Megaphone, Search,
  MessageCircle, FileText, ChevronDown, Loader2, Plane,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HoldingPatternIndicator } from "@/components/contacts/HoldingPatternIndicator";
import {
  useHoldingPatternList,
  useHoldingTimeline,
  type HoldingItem,
  type TimelineEntry,
} from "@/hooks/useHoldingPattern";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* ── Status groups ── */
const GROUPS: { key: string; label: string; color: string }[] = [
  { key: "contacted", label: "Contattati", color: "text-primary" },
  { key: "in_progress", label: "In Corso", color: "text-warning" },
  { key: "negotiation", label: "Trattativa", color: "text-chart-3" },
];

const SOURCE_LABELS: Record<string, string> = {
  partner: "Network",
  prospect: "Prospect",
  contact: "Contatto",
};

/* ── Timeline icons ── */
const TIMELINE_ICONS: Record<string, typeof Mail> = {
  send_email: Mail,
  email_sent: Mail,
  phone_call: Phone,
  meeting: Users,
  follow_up: RotateCcw,
  note: StickyNote,
  campaign: Megaphone,
  deep_search: Search,
  whatsapp: MessageCircle,
  other: FileText,
};

export function HoldingPatternTab() {
  const { data: items = [], isLoading } = useHoldingPatternList();
  const [selected, setSelected] = useState<HoldingItem | null>(null);
  const { data: timeline = [], isLoading: tlLoading } = useHoldingTimeline(selected);
  const queryClient = useQueryClient();

  const grouped = useMemo(() => {
    const map: Record<string, HoldingItem[]> = {};
    GROUPS.forEach((g) => (map[g.key] = []));
    items.forEach((i) => {
      if (map[i.leadStatus]) map[i.leadStatus].push(i);
    });
    return map;
  }, [items]);

  const handleChangeStatus = async (item: HoldingItem, newStatus: LeadStatus) => {
    try {
      const table =
        item.source === "partner" ? "partners" :
        item.source === "prospect" ? ("prospects" as any) :
        "imported_contacts";
      await supabase.from(table).update({ lead_status: newStatus } as any).eq("id", item.id);
      queryClient.invalidateQueries({ queryKey: ["holding-pattern-list"] });
      toast.success("Stato aggiornato");
    } catch {
      toast.error("Errore aggiornamento stato");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Caricamento circuito…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Plane className="w-10 h-10 opacity-30" />
        <p className="text-sm">Nessun contatto nel circuito di attesa</p>
        <p className="text-xs">I contatti appariranno qui quando il loro stato cambia da "Nuovo"</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: grouped list */}
      <div className="w-[40%] border-r border-border flex flex-col">
        <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
          <Plane className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Circuito di Attesa</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">{items.length}</Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {GROUPS.map((g) => {
              const groupItems = grouped[g.key] || [];
              if (!groupItems.length) return null;
              return (
                <Collapsible key={g.key} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted/50 text-xs font-medium">
                    <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]:rotate-180" />
                    <span className={g.color}>{g.label}</span>
                    <Badge variant="outline" className="ml-auto text-[9px] px-1">{groupItems.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 ml-2">
                    {groupItems.map((item) => (
                      <button
                        key={`${item.source}-${item.id}`}
                        onClick={() => setSelected(item)}
                        className={cn(
                          "w-full text-left px-2 py-2 rounded-md text-xs transition-colors",
                          selected?.id === item.id && selected?.source === item.source
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate flex-1">{item.name}</span>
                          <Badge variant="outline" className="text-[9px] px-1 shrink-0">
                            {SOURCE_LABELS[item.source]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                          {item.countryCode && (
                            <span className="text-[10px]">
                              {item.countryCode} {item.city ? `· ${item.city}` : ""}
                            </span>
                          )}
                          {item.lastInteractionAt && (
                            <span className="text-[10px] ml-auto">
                              {format(new Date(item.lastInteractionAt), "dd MMM", { locale: it })}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right: detail + timeline */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Seleziona un contatto per vedere la timeline
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{selected.name}</h3>
                <Badge variant="outline" className="text-[9px]">{SOURCE_LABELS[selected.source]}</Badge>
              </div>
              {selected.email && (
                <p className="text-xs text-muted-foreground">{selected.email}</p>
              )}
              <HoldingPatternIndicator
                status={selected.leadStatus as LeadStatus}
                onChangeStatus={(s) => handleChangeStatus(selected, s)}
              />
            </div>

            {/* Timeline */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {tlLoading ? (
                  <div className="flex items-center gap-2 justify-center py-8 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
                  </div>
                ) : !timeline.length ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nessuna interazione registrata
                  </p>
                ) : (
                  <TimelineView entries={timeline} />
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}

function TimelineView({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />
      {entries.map((e) => {
        const Icon = TIMELINE_ICONS[e.subType] || FileText;
        return (
          <div key={e.id} className="relative flex gap-3">
            <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
              <Icon className="w-3 h-3 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">{e.title}</span>
                {e.status && (
                  <Badge variant="outline" className="text-[9px] px-1">
                    {e.status === "completed" ? "Completata" : e.status === "pending" ? "Pending" : e.status}
                  </Badge>
                )}
                {e.outcome && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1",
                      e.outcome === "positive" && "bg-success/20 text-success",
                      e.outcome === "negative" && "bg-destructive/20 text-destructive"
                    )}
                  >
                    {e.outcome === "positive" ? "Positivo" : e.outcome === "negative" ? "Negativo" : "Neutro"}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[9px] px-1 ml-auto">
                  {e.type === "activity" ? "Attività" : e.type === "email" ? "Email" : "Interazione"}
                </Badge>
              </div>
              {e.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{e.description}</p>
              )}
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(e.date), "dd MMM yyyy HH:mm", { locale: it })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
