/**
 * HistoryTab — last 10 channel_messages for selected recipient (read-only).
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare } from "lucide-react";
import type { ForgeRecipient } from "../ForgeRecipientPicker";

interface Props {
  recipient: ForgeRecipient | null;
}

interface MessageRow {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body_text: string | null;
  from_address: string | null;
  email_date: string | null;
  created_at: string;
}

export function HistoryTab({ recipient }: Props) {
  const query = useQuery({
    queryKey: ["forge-history", recipient?.partnerId, recipient?.email],
    enabled: !!recipient && (!!recipient.partnerId || !!recipient.email),
    queryFn: async () => {
      if (!recipient) return [];
      let q = supabase
        .from("channel_messages")
        .select("id, channel, direction, subject, body_text, from_address, email_date, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (recipient.partnerId) q = q.eq("partner_id", recipient.partnerId);
      else if (recipient.email) q = q.or(`from_address.ilike.${recipient.email},to_address.ilike.${recipient.email}`);
      const { data } = await q;
      return (data ?? []) as MessageRow[];
    },
  });

  if (!recipient) return <div className="text-[11px] text-muted-foreground py-4 text-center">Seleziona un destinatario.</div>;

  return (
    <div className="space-y-2 text-xs">
      <div className="text-[10px] text-muted-foreground">
        Ultime 10 interazioni — è ciò che l'AI vede nel blocco "History" del prompt.
      </div>

      {query.isLoading && (
        <div className="flex items-center justify-center py-4 text-[11px] text-muted-foreground gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Caricamento…
        </div>
      )}

      {!query.isLoading && (query.data?.length ?? 0) === 0 && (
        <div className="text-center py-6 text-[11px] text-muted-foreground">
          <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
          Nessun messaggio trovato per questo destinatario.
        </div>
      )}

      <div className="space-y-1">
        {query.data?.map((m) => (
          <div key={m.id} className="rounded border border-border/40 bg-card p-2">
            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
              <Badge variant="outline" className="text-[9px]">{m.channel}</Badge>
              <Badge variant={m.direction === "inbound" ? "secondary" : "outline"} className="text-[9px]">
                {m.direction === "inbound" ? "↓ inbound" : "↑ outbound"}
              </Badge>
              <span className="text-muted-foreground">{m.email_date ? new Date(m.email_date).toLocaleString("it-IT") : new Date(m.created_at).toLocaleString("it-IT")}</span>
              {m.from_address && <span className="text-muted-foreground truncate">· {m.from_address}</span>}
            </div>
            {m.subject && <div className="font-medium text-[11px] mt-1 truncate">{m.subject}</div>}
            {m.body_text && <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{m.body_text.slice(0, 200)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
