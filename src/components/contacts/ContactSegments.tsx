/**
 * ContactSegments — Dropdown with predefined contact filter segments.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Filter, UserX, Clock, ThumbsUp, ThumbsDown, BellRing, TrendingUp, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentKey =
  | "mai_contattati"
  | "in_attesa_risposta"
  | "risposta_positiva"
  | "risposta_negativa"
  | "follow_up_dovuto"
  | "alta_priorita"
  | "da_recuperare"
  | null;

interface ContactSegmentsProps {
  activeSegment: SegmentKey;
  onSegmentChange: (segment: SegmentKey) => void;
}

interface SegmentDef {
  key: SegmentKey;
  label: string;
  icon: React.ReactNode;
}

const SEGMENTS: SegmentDef[] = [
  { key: "mai_contattati", label: "Mai contattati", icon: <UserX className="h-3.5 w-3.5" /> },
  { key: "in_attesa_risposta", label: "In attesa risposta", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "risposta_positiva", label: "Risposta positiva", icon: <ThumbsUp className="h-3.5 w-3.5" /> },
  { key: "risposta_negativa", label: "Risposta negativa", icon: <ThumbsDown className="h-3.5 w-3.5" /> },
  { key: "follow_up_dovuto", label: "Follow-up dovuto", icon: <BellRing className="h-3.5 w-3.5" /> },
  { key: "alta_priorita", label: "Alta priorità", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "da_recuperare", label: "Da recuperare", icon: <Undo2 className="h-3.5 w-3.5" /> },
];

export function ContactSegments({ activeSegment, onSegmentChange }: ContactSegmentsProps): React.ReactElement {
  // Fetch segment counts
  const { data: segmentCounts } = useQuery({
    queryKey: ["contact-segment-counts"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return {};

      // Fetch contacts with key fields
      const { data: contacts } = await supabase
        .from("imported_contacts")
        .select("id, email, interaction_count, last_interaction_at")
        .eq("user_id", userId)
        .limit(1000);

      // Fetch conversation context for sentiment/response data
      const { data: contexts } = await supabase
        .from("contact_conversation_context")
        .select("email_address, dominant_sentiment, response_rate, last_interaction_at")
        .eq("user_id", userId)
        .limit(1000);

      const contextMap = new Map<string, Record<string, unknown>>();
      for (const ctx of (contexts || [])) {
        contextMap.set(ctx.email_address, ctx);
      }

      const now = Date.now();
      const sevenDays = 7 * 86400000;
      const counts: Record<string, number> = {};

      for (const seg of SEGMENTS) {
        counts[seg.key!] = 0;
      }

      for (const c of (contacts || []) as Record<string, unknown>[]) {
        const interactionCount = Number(c.interaction_count) || 0;
        const lastAt = c.last_interaction_at ? new Date(c.last_interaction_at as string).getTime() : 0;
        const ctx = contextMap.get(c.email as string);
        const sentiment = ctx?.dominant_sentiment as string | undefined;
        const responseRate = Number(ctx?.response_rate) || 0;
        const successRate = responseRate; // approximation

        if (interactionCount === 0) counts.mai_contattati++;
        if (interactionCount > 0 && !ctx) counts.in_attesa_risposta++;
        if (sentiment === "positive") counts.risposta_positiva++;
        if (sentiment === "negative") counts.risposta_negativa++;
        if (interactionCount > 0 && lastAt > 0 && (now - lastAt) > sevenDays && !ctx) counts.follow_up_dovuto++;
        if (successRate > 70 && responseRate > 50) counts.alta_priorita++;
        if (interactionCount > 0 && sentiment === "negative") counts.da_recuperare++;
      }

      return counts;
    },
    staleTime: 30000,
  });

  const activeLabel = SEGMENTS.find((s) => s.key === activeSegment)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px] gap-1",
            activeSegment ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground"
          )}
        >
          <Filter className="h-3 w-3" />
          {activeLabel || "Segmenti"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {activeSegment && (
          <>
            <DropdownMenuItem onClick={() => onSegmentChange(null)} className="text-xs text-muted-foreground">
              Rimuovi filtro segmento
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {SEGMENTS.map((seg) => {
          const count = segmentCounts?.[seg.key!] ?? 0;
          return (
            <DropdownMenuItem
              key={seg.key}
              onClick={() => onSegmentChange(seg.key)}
              className={cn(
                "text-xs flex items-center justify-between",
                activeSegment === seg.key && "bg-primary/10 text-primary"
              )}
            >
              <span className="flex items-center gap-2">
                {seg.icon}
                {seg.label}
              </span>
              <Badge variant="outline" className="text-[9px] h-4 px-1 border-border/40 ml-2">
                {count}
              </Badge>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
