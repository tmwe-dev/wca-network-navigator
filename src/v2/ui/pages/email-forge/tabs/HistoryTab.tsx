/**
 * HistoryTab — last 10 channel_messages for selected recipient (read-only).
 */
import { useQuery } from "@tanstack/react-query";
import { fetchRecipientHistory, type RecipientHistoryRow } from "@/v2/io/supabase/queries/channel-messages";
import { isOk } from "@/v2/core/domain/result";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare } from "lucide-react";
import type { ForgeRecipient } from "../ForgeRecipientPicker";

interface Props {
  recipient: ForgeRecipient | null;
}

type MessageRow = RecipientHistoryRow;

export function HistoryTab({ recipient }: Props) {
  const query = useQuery<MessageRow[]>({
    queryKey: ["forge-history", recipient?.partnerId, recipient?.email],
    enabled: !!recipient && (!!recipient.partnerId || !!recipient.email),
    queryFn: async () => {
      if (!recipient) return [];
      // B4.2 — SSOT DAL: view canonica con fallback interno trasparente.
      const r = await fetchRecipientHistory({
        partnerId: recipient.partnerId,
        email: recipient.email,
        limit: 10,
      });
      return isOk(r) ? r.value : [];
    },
  });

  if (!recipient)
    return <div className="text-[11px] text-muted-foreground py-4 text-center">Seleziona un destinatario.</div>;

  return (
    <div className="space-y-2 text-xs">
      <div className="text-xs text-foreground">
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
          <div key={m.id} className="rounded border border-border/60 bg-card p-2">
            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
              <Badge variant="outline" className="text-[9px]">
                {m.channel}
              </Badge>
              <Badge variant={m.direction === "inbound" ? "secondary" : "outline"} className="text-[9px]">
                {m.direction === "inbound" ? "↓ inbound" : "↑ outbound"}
              </Badge>
              <span className="text-muted-foreground">
                {m.email_date
                  ? new Date(m.email_date).toLocaleString("it-IT")
                  : new Date(m.created_at).toLocaleString("it-IT")}
              </span>
              {m.from_address && <span className="text-muted-foreground truncate">· {m.from_address}</span>}
            </div>
            {m.subject && <div className="font-medium text-[11px] mt-1 truncate">{m.subject}</div>}
            {m.body_text && (
              <div className="text-xs text-foreground line-clamp-2 mt-0.5">{m.body_text.slice(0, 200)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
