/**
 * EmailCard — riga lista email su template canonico EntityRow.
 * Logic-less: i dati arrivano da `EmailCardEntity`, le azioni dai callback.
 *
 * Layout (template unificato app):
 *   ☑ | 🏳 ISO | AZIENDA + badge / persona · email / preview 2 righe | recency · città · canali · score | ⋯
 */
import * as React from "react";
import {
  MoreHorizontal,
  Mail,
  CalendarClock,
  Sparkles,
  Tag,
  Paperclip,
  Brain,
  ExternalLink,
  CheckCheck,
  Plane,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EntityRow } from "@/v2/ui/atoms/EntityRow";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { EmailCardEntity, EmailCardCallbacks } from "./types";

export interface EmailCardProps extends EmailCardCallbacks {
  email: EmailCardEntity;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  compact?: boolean;
  onCountryClick?: (code: string) => void;
  onCityClick?: (city: string) => void;
}

function relRecency(iso?: string | null): { label: string; tone: "ok" | "warn" | "alert" | "muted" } {
  if (!iso) return { label: "—", tone: "muted" };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { label: "—", tone: "muted" };
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 60) return { label: `${Math.max(1, mins)}m fa`, tone: "ok" };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { label: `${hrs}h fa`, tone: "ok" };
  const days = Math.floor(hrs / 24);
  if (days < 7) return { label: `${days}g fa`, tone: "warn" };
  if (days < 30) return { label: `${days}g fa`, tone: "warn" };
  return { label: `${days}g fa`, tone: "alert" };
}

export function EmailCard({
  email,
  selected,
  onToggleSelect,
  compact = false,
  onCountryClick,
  onCityClick,
  onOpen,
  onReclassify,
  onMarkRead,
  onArchive,
  onAddToAgenda,
}: EmailCardProps): React.ReactElement {
  const recency = React.useMemo(() => relRecency(email.dateIso), [email.dateIso]);

  const titleSlot = (
    <>
      {email.unread && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" title="Non letta" />
      )}
      <span className="truncate uppercase tracking-wide text-foreground">
        {email.company || "—"}
      </span>
      {email.folderLabel && (
        <Badge
          variant="outline"
          className="text-[9px] flex-shrink-0 px-1 py-0 h-4 bg-primary/15 text-primary border-primary/30 gap-0.5"
          title={`Cartella: ${email.folderLabel}`}
        >
          {email.folderIcon ? <span>{email.folderIcon}</span> : <Tag className="w-2.5 h-2.5" />}
          <span className="max-w-[120px] truncate">{email.folderLabel}</span>
        </Badge>
      )}
      {email.aiSuggestion && email.aiSuggestion !== email.folderLabel && (
        <Badge
          variant="outline"
          className="text-[9px] flex-shrink-0 px-1 py-0 h-4 border-dashed border-chart-2/40 text-chart-2 bg-chart-2/10 gap-0.5"
          title="Suggerimento AI"
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span className="max-w-[120px] truncate">{email.aiSuggestion}</span>
        </Badge>
      )}
      {email.urgency === "critical" && (
        <Badge variant="outline" className="text-[9px] flex-shrink-0 px-1 py-0 h-4 bg-destructive/15 text-destructive border-destructive/30">
          Urgente
        </Badge>
      )}
      {email.urgency === "high" && (
        <Badge variant="outline" className="text-[9px] flex-shrink-0 px-1 py-0 h-4 bg-amber-500/15 text-amber-500 border-amber-500/30">
          Alta
        </Badge>
      )}
      {email.goesToAgenda && (
        <Badge variant="outline" className="text-[9px] flex-shrink-0 px-1 py-0 h-4 bg-chart-3/15 text-chart-3 border-chart-3/30 gap-0.5">
          <CalendarClock className="w-2.5 h-2.5" />
          Agenda
        </Badge>
      )}
      {email.hasAttachments && (
        <span title="Allegati" className="text-muted-foreground flex-shrink-0">
          <Paperclip className="w-3 h-3" />
        </span>
      )}
      {email.inHolding && (
        <span title="In circuito di attesa">
          <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0 animate-pulse" />
        </span>
      )}
    </>
  );

  const subTitleSlot = (
    <>
      {email.personName ? (
        <>
          <span className="truncate font-medium text-foreground/70">{email.personName}</span>
          {email.personRole && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="truncate">{email.personRole}</span>
            </>
          )}
        </>
      ) : null}
      {email.fromAddress && (
        <>
          {email.personName && <span className="text-muted-foreground/40">·</span>}
          <span className="truncate text-[10px] text-muted-foreground/80" title={email.fromAddress}>
            {email.fromAddress.replace(/.*<|>.*/g, "") || email.fromAddress}
          </span>
        </>
      )}
    </>
  );

  const previewSlot = email.subject ? (
    <>
      <span className={cn("font-medium", email.unread ? "text-foreground" : "text-foreground/80")}>
        {email.subject}
      </span>
      {email.preview && (
        <span className="text-muted-foreground/80"> — {email.preview}</span>
      )}
    </>
  ) : null;

  const recencySlot = (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0 rounded flex-shrink-0",
        recency.tone === "ok" && "text-emerald-500",
        recency.tone === "warn" && "text-amber-500",
        recency.tone === "alert" && "text-destructive",
        recency.tone === "muted" && "text-muted-foreground/50"
      )}
      title={email.dateIso ? new Date(email.dateIso).toLocaleString() : undefined}
    >
      <Clock className="w-2.5 h-2.5" /> {recency.label}
    </span>
  );

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden transition-all",
        selected && "ring-1 ring-primary/60 bg-primary/[0.05]"
      )}
    >
      <EntityRow
        tone="email"
        countryCode={email.countryCode ?? null}
        selected={selected}
        compact={compact}
        onCountryClick={onCountryClick}
        onCityClick={onCityClick}
        checkboxSlot={
          onToggleSelect ? (
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onToggleSelect(email.id)}
              aria-label={`Seleziona ${email.subject}`}
              className="h-3.5 w-3.5"
            />
          ) : undefined
        }
        titleSlot={titleSlot}
        subTitleSlot={subTitleSlot}
        previewSlot={previewSlot}
        city={email.city ?? null}
        score={email.score ?? null}
        recencySlot={recencySlot}
        actionsSlot={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                aria-label="Azioni rapide"
                title="Azioni rapide"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {email.company}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpen?.(email.id)}>
                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Apri
              </DropdownMenuItem>
              {onReclassify && (
                <DropdownMenuItem onClick={() => onReclassify(email.id)}>
                  <Brain className="w-3.5 h-3.5 mr-2 text-chart-2" /> Riclassifica con AI
                </DropdownMenuItem>
              )}
              {email.unread && onMarkRead && (
                <DropdownMenuItem onClick={() => onMarkRead(email.id)}>
                  <CheckCheck className="w-3.5 h-3.5 mr-2 text-primary" /> Segna come letta
                </DropdownMenuItem>
              )}
              {onAddToAgenda && (
                <DropdownMenuItem onClick={() => onAddToAgenda(email.id)}>
                  <CalendarClock className="w-3.5 h-3.5 mr-2 text-chart-3" /> Aggiungi all'agenda
                </DropdownMenuItem>
              )}
              {onArchive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onArchive(email.id)}>
                    <Mail className="w-3.5 h-3.5 mr-2" /> Archivia
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        onClick={() => onOpen?.(email.id)}
      />
    </div>
  );
}

export default EmailCard;