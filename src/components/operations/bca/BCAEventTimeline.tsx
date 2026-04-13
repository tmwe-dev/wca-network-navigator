/**
 * BCAEventTimeline — Groups business cards by event into horizontal timeline
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, CheckCircle2, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

interface EventGroup {
  key: string;
  eventName: string;
  location: string | null;
  date: string | null;
  cards: BusinessCardWithPartner[];
  matchedCount: number;
  withEmailCount: number;
}

export function BCAEventTimeline({ cards }: { cards: BusinessCardWithPartner[] }) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const groups = useMemo((): EventGroup[] => {
    const map = new Map<string, BusinessCardWithPartner[]>();

    for (const card of cards) {
      const key = card.event_name
        ? `${card.event_name}__${card.met_at || "nodate"}`
        : "__no_event__";
      const arr = map.get(key) || [];
      arr.push(card);
      map.set(key, arr);
    }

    return Array.from(map.entries())
      .map(([key, groupCards]) => ({
        key,
        eventName: groupCards[0].event_name || "Senza evento",
        location: groupCards[0].location,
        date: groupCards[0].met_at,
        cards: groupCards,
        matchedCount: groupCards.filter((c) => c.match_status === "matched").length,
        withEmailCount: groupCards.filter((c) => c.email).length,
      }))
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [cards]);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Nessun biglietto da visita
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 px-4 py-2 bg-muted/20 rounded-lg border border-border/30">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{groups.length}</p>
          <p className="text-[10px] text-muted-foreground">Eventi</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{cards.length}</p>
          <p className="text-[10px] text-muted-foreground">Biglietti</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-emerald-400">{cards.filter((c) => c.match_status === "matched").length}</p>
          <p className="text-[10px] text-muted-foreground">Matchati</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{cards.filter((c) => c.email).length}</p>
          <p className="text-[10px] text-muted-foreground">Con email</p>
        </div>
      </div>

      {/* Horizontal timeline */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-start gap-3 min-w-max px-2">
          {groups.map((group, idx) => {
            const isExpanded = expandedEvent === group.key;
            const convRate = group.cards.length > 0
              ? Math.round((group.matchedCount / group.cards.length) * 100)
              : 0;

            return (
              <div key={group.key} className="flex flex-col items-center">
                {/* Timeline connector */}
                <div className="flex items-center">
                  {idx > 0 && <div className="w-8 h-0.5 bg-border/50" />}
                  <button
                    onClick={() => setExpandedEvent(isExpanded ? null : group.key)}
                    className={cn(
                      "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                      isExpanded
                        ? "border-primary bg-primary/20 scale-110"
                        : "border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <Handshake className={cn("w-5 h-5", isExpanded ? "text-primary" : "text-muted-foreground")} />
                  </button>
                  {idx < groups.length - 1 && <div className="w-8 h-0.5 bg-border/50" />}
                </div>

                {/* Event info */}
                <div className={cn(
                  "mt-2 text-center max-w-[160px] cursor-pointer",
                )} onClick={() => setExpandedEvent(isExpanded ? null : group.key)}>
                  <p className="text-xs font-medium text-foreground truncate">{group.eventName}</p>
                  {group.date && (
                    <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {format(new Date(group.date), "dd MMM yyyy", { locale: it })}
                    </p>
                  )}
                  {group.location && (
                    <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                      <MapPin className="w-2.5 h-2.5" /> {group.location}
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">{group.cards.length}</Badge>
                    <span className="text-[9px] text-emerald-400">{convRate}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded event cards */}
      {expandedEvent && (() => {
        const group = groups.find((g) => g.key === expandedEvent);
        if (!group) return null;
        return (
          <div className="border border-primary/20 rounded-xl p-4 bg-primary/[0.02] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{group.eventName}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {group.cards.length} biglietti · {group.matchedCount} matchati · {group.withEmailCount} con email
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Conversione: <strong className="text-emerald-400">{group.cards.length > 0 ? Math.round((group.matchedCount / group.cards.length) * 100) : 0}%</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {group.cards.map((card) => (
                <div key={card.id} className={cn(
                  "rounded-lg border p-2.5 transition-colors",
                  card.match_status === "matched" ? "border-primary/20 bg-primary/5" : "border-border/40 bg-card/50"
                )}>
                  <p className="text-xs font-medium text-foreground truncate">{card.company_name || "—"}</p>
                  {card.contact_name && <p className="text-[11px] text-muted-foreground truncate">{card.contact_name}</p>}
                  {card.email && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{card.email}</p>}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {card.match_status === "matched" && (
                      <Badge variant="outline" className="text-[8px] h-4 px-1 border-emerald-500/30 text-emerald-400">
                        <CheckCircle2 className="w-2 h-2 mr-0.5" /> Match
                      </Badge>
                    )}
                    {card.email && <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary/20">Email</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
