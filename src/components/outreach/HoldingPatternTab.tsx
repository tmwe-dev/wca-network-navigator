import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Mail, Phone, Users, RotateCcw, StickyNote, Megaphone, Search,
  MessageCircle, FileText, ChevronDown, Loader2, Plane, ArrowRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HoldingPatternIndicator } from "@/components/contacts/HoldingPatternIndicator";
import { useHoldingPatternList, useHoldingTimeline, type HoldingItem } from "@/hooks/useHoldingPattern";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/hooks/useContacts";
import { updateLeadStatus } from "@/data/partners";
import { updateProspectLeadStatus } from "@/data/prospects";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { createLogger } from "@/lib/log";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("HoldingPatternTab");

/* ── Status groups ── */
const GROUPS: { key: string; label: string; color: string; count?: number }[] = [
  { key: "contacted", label: "Contattati", color: "text-primary" },
  { key: "in_progress", label: "In Corso", color: "text-amber-500" },
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
  const navigate = useAppNavigate();
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
      if (item.source === "partner") {
        await updateLeadStatus("partners", item.id, newStatus);
      } else if (item.source === "prospect") {
        await updateProspectLeadStatus(item.id, newStatus);
      } else {
        await updateLeadStatus("imported_contacts", item.id, newStatus);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.holdingPatternList() });
      toast.success("Stato aggiornato");
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Errore aggiornamento stato");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={Plane}
        title="Circuito di attesa vuoto"
        description="I contatti appariranno qui dopo il primo contatto. Vai al Cockpit per iniziare una conversazione."
        actionLabel="Vai al Cockpit"
        onAction={() => navigate("/outreach")}
        className="h-full"
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: grouped list */}
      <div className="w-[40%] border-r border-border/40 flex flex-col">
        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
          <Plane className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">Circuito</span>
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
                    <ChevronDown className="w-3 h-3 transition-transform" />
                    <span className={g.color}>{g.label}</span>
                    <Badge variant="outline" className="ml-auto text-[9px] px-1">{groupItems.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 ml-2">
                    {groupItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelected(item)}
                        className={cn(
                          "w-full text-left px-2 py-2 rounded-md text-xs transition-colors flex items-center gap-2",
                          selected?.id === item.id
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {item.email || "—"} · {SOURCE_LABELS[item.source] || item.source}
                          </div>
                          {(item.agentEmoji || item.tutorName) && (
                            <div className="text-[9px] text-muted-foreground/70 truncate mt-0.5 flex items-center gap-1">
                              {item.agentEmoji && <span>{item.agentEmoji}</span>}
                              {item.tutorName && <span className="truncate">{item.tutorName}</span>}
                            </div>
                          )}
                        </div>
                        <HoldingPatternIndicator status={item.leadStatus as LeadStatus} />
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right: detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-1">
              <ArrowRight className="w-5 h-5 text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">Seleziona un contatto</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border/40">
              <h3 className="text-sm font-semibold">{selected.name}</h3>
              <p className="text-xs text-muted-foreground">{selected.email || "Nessun contatto"}</p>
              {(selected.agentEmoji || selected.tutorName) && (
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/80">
                  {selected.agentEmoji && <span className="text-sm">{selected.agentEmoji}</span>}
                  {selected.agentName && <span className="font-medium">{selected.agentName}</span>}
                  {selected.tutorName && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>Tutor: {selected.tutorName}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {/* Status changer */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Stato:</span>
                  {GROUPS.map((g) => (
                    <button
                      key={g.key}
                      onClick={() => handleChangeStatus(selected, g.key as LeadStatus)}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded font-medium transition-colors",
                        selected.leadStatus === g.key
                          ? cn(g.color, "bg-current/10 ring-1 ring-current/30")
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleChangeStatus(selected, "converted" as LeadStatus)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded font-medium transition-colors",
                      selected.leadStatus === "converted"
                        ? "text-chart-3 bg-chart-3/10 ring-1 ring-chart-3/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    Chiuso
                  </button>
                </div>

                {/* Timeline */}
                <div className="space-y-2 mt-4">
                  <h4 className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Timeline</h4>
                  {tlLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : timeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nessuna interazione registrata</p>
                  ) : (
                    timeline.map((entry, i) => {
                      const Icon = TIMELINE_ICONS[entry.type] || FileText;
                      return (
                        <div key={i} className="flex gap-2 items-start">
                          <div className="w-6 h-6 rounded flex items-center justify-center bg-muted/40 shrink-0 mt-0.5">
                            <Icon className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">{entry.title}</p>
                            <p className="text-[10px] text-muted-foreground">{entry.description}</p>
                          </div>
                          <span className="text-[9px] text-muted-foreground shrink-0">
                            {format(new Date(entry.date), "dd MMM", { locale: it })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
