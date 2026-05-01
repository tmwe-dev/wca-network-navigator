/**
 * OutreachRow — Riga unificata usata in In Uscita, Storico Attività e Risposte.
 *
 *   [LOGO]  Acme Logistics · Vietnam            [↗ Email]   ⏰ 24 apr 09:20
 *           Maria Nguyen <maria@acme.vn>                    👤 Manuale
 *           ✉️  "Re: Quotation for Hanoi-Genoa route"
 *           Aspetta la tua risposta · ricevuta 2h fa
 *                                              [Approva] [Rispondi] [⋯]
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CompanyAvatar } from "./CompanyAvatar";
import { ActionIcon, type ActionKind, actionLabel } from "./ActionIcon";
import { SourcePill, type SourceKind } from "./SourcePill";
import { AbsoluteTime, RelativeTime } from "./RelativeTime";

export interface OutreachRowProps {
  readonly companyName: string;
  readonly contactName?: string | null;
  readonly contactEmail?: string | null;
  readonly country?: string | null;
  readonly subject?: string | null;
  readonly preview?: string | null;
  /** Frase italiana sotto il preview (es: "Aspetta la tua risposta", "Pronta per partire alle 10:30"). */
  readonly statusLine?: string | null;
  readonly actionKind: ActionKind;
  readonly source: SourceKind;
  readonly sourceLabel?: string;       // override (es: "Sequenza step 2/4")
  readonly date?: string | Date | null;
  readonly relativeDate?: string | Date | null;
  readonly relativePrefix?: string;
  readonly overdue?: boolean;
  readonly selected?: boolean;
  readonly unread?: boolean;
  readonly leftSlot?: ReactNode;       // checkbox o altro
  readonly rightSlot?: ReactNode;      // bottoni azione
  readonly onClick?: () => void;
}

export function OutreachRow({
  companyName, contactName, contactEmail, country,
  subject, preview, statusLine,
  actionKind, source, sourceLabel, date, relativeDate, relativePrefix, overdue,
  selected, unread, leftSlot, rightSlot, onClick,
}: OutreachRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors",
        onClick && "cursor-pointer hover:bg-muted/30",
        selected && "bg-primary/8 ring-1 ring-primary/30",
        unread && !selected && "border-l-2 border-primary",
      )}
    >
      {leftSlot}
      <CompanyAvatar companyName={companyName} email={contactEmail} size="md" />

      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Riga 1: azienda + paese + sorgente + data */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[12px] truncate", unread ? "font-bold text-foreground" : "font-semibold text-foreground")}>
            {companyName || "—"}
          </span>
          {country && <span className="text-[10px] text-muted-foreground">· {country}</span>}
          <SourcePill kind={source} compact customLabel={sourceLabel} />
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {date && <AbsoluteTime date={date} />}
          </div>
        </div>

        {/* Riga 2: contatto */}
        {(contactName || contactEmail) && (
          <p className="text-[10.5px] text-muted-foreground truncate">
            {contactName ? <span className="font-medium">{contactName}</span> : null}
            {contactName && contactEmail ? <span className="opacity-60"> · </span> : null}
            {contactEmail ? <span>{contactEmail}</span> : null}
          </p>
        )}

        {/* Riga 3: icona azione + soggetto */}
        <div className="flex items-center gap-1.5">
          <ActionIcon kind={actionKind} size="sm" />
          <span className="text-[11px] text-foreground/90 truncate">
            <span className="text-muted-foreground">{actionLabel(actionKind)}:</span>{" "}
            <span className="italic">{subject || preview || "—"}</span>
          </span>
        </div>

        {/* Riga 4: status line + tempo relativo */}
        {(statusLine || relativeDate) && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {statusLine && <span>{statusLine}</span>}
            {statusLine && relativeDate && <span className="opacity-50">·</span>}
            {relativeDate && <RelativeTime date={relativeDate} prefix={relativePrefix} highlightOverdue={overdue} />}
          </div>
        )}
      </div>

      {rightSlot && <div className="flex items-center gap-1 shrink-0 self-center">{rightSlot}</div>}
    </div>
  );
}
