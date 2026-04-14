/**
 * SenderProfilesView — Per-sender profile cards
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCircle, Clock, TrendingUp, MessageCircle } from "lucide-react";

const SENTIMENTS: Record<string, string> = {
  positive: "bg-emerald-400",
  negative: "bg-red-400",
  neutral: "bg-muted-foreground",
  mixed: "bg-yellow-400",
};

function initialsColor(email: string): string {
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-pink-500", "bg-cyan-500", "bg-red-500"];
  let hash = 0;
  for (const c of email) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export function SenderProfilesView() {
  const [sortBy, setSortBy] = useState<string>("interaction_count");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["sender-profiles", sortBy],
    queryFn: async () => {
      // Combine conversation context with rules
      const [ctxRes, rulesRes] = await Promise.all([
        supabase.from("contact_conversation_context").select("*").order(
          sortBy === "last_interaction" ? "last_interaction_at" : sortBy === "response_rate" ? "response_rate" : "interaction_count",
          { ascending: false }
        ).limit(50),
        supabase.from("email_address_rules").select("email_address, auto_action, preferred_channel, ai_confidence_threshold, success_rate, display_name, is_active"),
      ]);
      if (ctxRes.error) throw ctxRes.error;

      const rulesMap = new Map<string, any>();
      for (const r of rulesRes.data ?? []) rulesMap.set(r.email_address, r);

      return (ctxRes.data ?? []).map(ctx => ({
        ...ctx,
        rules: rulesMap.get(ctx.email_address) ?? null,
      }));
    },
  });

  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Ordina per" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="interaction_count">Interazioni</SelectItem>
            <SelectItem value="last_interaction">Ultima interazione</SelectItem>
            <SelectItem value="response_rate">Response rate</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">{profiles.length} profili</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <UserCircle className="h-10 w-10 mb-2 text-primary/30" />
          <p className="text-xs">Nessun profilo sender disponibile</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
            {profiles.map((p) => {
              const initials = p.email_address.substring(0, 2).toUpperCase();
              const exchanges = Array.isArray(p.last_exchanges) ? p.last_exchanges as any[] : [];
              const lastSentiments = exchanges.slice(-5).map((e) => e.sentiment ?? "neutral");
              const expanded = expandedEmail === p.email_address;

              return (
                <div key={p.id} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${initialsColor(p.email_address)}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{p.rules?.display_name || p.email_address}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.email_address}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.interaction_count ?? 0}</span>
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{Math.round(p.response_rate ?? 0)}%</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.avg_response_time_hours != null ? `${Math.round(p.avg_response_time_hours)}h` : "—"}</span>
                    {p.rules?.success_rate != null && <span>✓ {Math.round(p.rules.success_rate)}%</span>}
                  </div>

                  {/* Sentiment trend */}
                  {lastSentiments.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Sentiment:</span>
                      {lastSentiments.map((s: string, i: number) => (
                        <div key={i} className={`h-2.5 w-2.5 rounded-full ${SENTIMENTS[s] ?? SENTIMENTS.neutral}`} />
                      ))}
                    </div>
                  )}

                  {/* Rules summary */}
                  {p.rules && (
                    <div className="flex flex-wrap gap-1">
                      {p.rules.auto_action && p.rules.auto_action !== "none" && (
                        <Badge className="text-[10px] bg-primary/10 text-primary">{p.rules.auto_action}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{p.rules.preferred_channel ?? "email"}</Badge>
                    </div>
                  )}

                  {/* Conversation timeline */}
                  <Button
                    size="sm" variant="ghost"
                    className="h-6 text-[10px] w-full"
                    onClick={() => setExpandedEmail(expanded ? null : p.email_address)}
                  >
                    {expanded ? "Nascondi conversazione" : "Vedi conversazione"}
                  </Button>

                  {expanded && exchanges.length > 0 && (
                    <div className="space-y-1 border-t border-border/30 pt-2">
                      {exchanges.slice(-5).map((ex: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-[10px]">
                          <div className={`h-1.5 w-1.5 rounded-full mt-1 ${SENTIMENTS[ex.sentiment] ?? SENTIMENTS.neutral}`} />
                          <span className="text-muted-foreground">{ex.direction === "inbound" ? "←" : "→"} {ex.summary ?? ex.subject ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
