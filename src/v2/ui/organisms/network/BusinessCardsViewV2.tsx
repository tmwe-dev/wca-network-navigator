/**
 * BusinessCardsViewV2 — BCA business cards list with match status
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert } from "lucide-react";
import { EmptyState } from "../../atoms/EmptyState";
import { StatusBadge } from "../../atoms/StatusBadge";
import { queryKeys } from "@/lib/queryKeys";
import { useBlacklistedCompanyNames } from "@/hooks/useBlacklist";
import { Badge } from "@/components/ui/badge";

export function BusinessCardsViewV2(): React.ReactElement {
  const { data: cards, isLoading } = useQuery({
    queryKey: queryKeys.v2.businessCards(),
    queryFn: async () => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return [];
      const { data, error } = await supabase
        .from("business_cards")
        .select("id, company_name, contact_name, email, phone, match_status, match_confidence, lead_status, event_name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: blacklistNames } = useBlacklistedCompanyNames();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return <EmptyState title="Nessun biglietto da visita" description="I BCA appariranno qui dopo l'importazione." />;
  }

  const matchStatusMap: Record<string, "success" | "warning" | "error" | "info"> = {
    matched: "success",
    partial: "warning",
    unmatched: "error",
    pending: "info",
  };

  return (
    <div className="space-y-1 p-4">
      {cards.map((card) => (
        <BcaCardRow key={card.id} card={card} matchStatusMap={matchStatusMap} blacklistNames={blacklistNames} />
      ))}
    </div>
  );
}

interface BcaCardRowProps {
  card: { id: string; company_name: string | null; contact_name: string | null; email: string | null; phone: string | null; match_status: string; match_confidence: number | null; lead_status: string | null; event_name: string | null; created_at: string };
  matchStatusMap: Record<string, "success" | "warning" | "error" | "info">;
  blacklistNames: Set<string> | undefined;
}

function BcaCardRow({ card, matchStatusMap, blacklistNames }: BcaCardRowProps): React.ReactElement {
  const norm = (card.company_name ?? "").toLowerCase().trim();
  const isBlacklisted = !!blacklistNames && !!norm && blacklistNames.has(norm);
  return (
    <div
      className={
        "flex items-center gap-3 p-2.5 rounded-md border hover:bg-accent/50 transition-colors " +
        (isBlacklisted ? "border-destructive/40 bg-destructive/[0.04]" : "")
      }
    >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate text-foreground">{card.company_name ?? "—"}</span>
              {card.contact_name && (
                <span className="text-xs text-muted-foreground truncate">{card.contact_name}</span>
              )}
              {isBlacklisted && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-destructive/15 text-destructive border-destructive/40 font-semibold flex-shrink-0"
                  title="Azienda presente nella blacklist WCA World"
                >
                  <ShieldAlert className="w-2.5 h-2.5" />
                  Blacklist
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {card.email && <span>{card.email}</span>}
              {card.event_name && <span>· {card.event_name}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge
              status={matchStatusMap[card.match_status] ?? "info"}
              label={card.match_status}
            />
            {card.match_confidence != null && card.match_confidence > 0 && (
              <span className="text-[10px] text-muted-foreground">{Math.round(card.match_confidence)}%</span>
            )}
          </div>
    </div>
  );
}
