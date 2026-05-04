/**
 * MailList — colonna centrale: lista email della cartella selezionata.
 *
 * Per ogni mail mostra: badge urgenza, oggetto, mittente, età, badge azione.
 */
import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { FunnemailMailRow } from "@/data/funnemailInbox";

interface Props {
  mails: FunnemailMailRow[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  folderLabel: string;
}

const URGENCY_COLOR: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  normal: "border-l-blue-500/40",
  low: "border-l-muted-foreground/30",
};

const ACTION_LABEL: Record<string, string> = {
  none: "—",
  archive: "Archivia",
  draft_reply: "Bozza",
  forward: "Inoltra",
  escalate: "Escala",
  notify_human: "Avvisa",
};

export function MailList({ mails, loading, selectedId, onSelect, folderLabel }: Props): React.ReactElement {
  return (
    <section className="w-[380px] shrink-0 border-r border-border/40 flex flex-col h-full">
      <header className="px-4 py-2 border-b border-border/40 flex-shrink-0">
        <h3 className="text-sm font-semibold truncate">{folderLabel}</h3>
        <p className="text-[11px] text-muted-foreground">{mails.length} mail{mails.length === 1 ? "" : "s"}</p>
      </header>
      <ScrollArea className="flex-1">
        {loading && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Caricamento…</div>}
        {!loading && mails.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Nessuna email in questa cartella
          </div>
        )}
        <ul>
          {mails.map((m) => {
            const urgency = m.decision?.urgency ?? "normal";
            const action = m.decision?.suggested_action ?? "none";
            const active = m.message_id === selectedId;
            const date = m.email_date ? new Date(m.email_date) : null;
            return (
              <li key={m.message_id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.message_id)}
                  className={cn(
                    "w-full text-left px-3 py-2 border-b border-border/30 border-l-2 transition-colors",
                    URGENCY_COLOR[urgency] ?? URGENCY_COLOR.normal,
                    active ? "bg-primary/10" : "hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <span className="text-xs font-medium truncate flex-1">
                      {m.subject || "(senza oggetto)"}
                    </span>
                    {date && (
                      <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDistanceToNow(date, { addSuffix: false, locale: it })}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.from_address ?? "—"}</div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {action !== "none" && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        {ACTION_LABEL[action] ?? action}
                      </Badge>
                    )}
                    {m.decision?.commercial_handoff && (
                      <Badge className="text-[9px] px-1 py-0 h-4 bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15">
                        Commerciale
                      </Badge>
                    )}
                    {m.decision?.goes_to_agenda && (
                      <Badge className="text-[9px] px-1 py-0 h-4 bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/15">
                        Agenda
                      </Badge>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </section>
  );
}