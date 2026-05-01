/**
 * EntityRow — template a 5 colonne fisse per le liste WCA / CRM / BCA.
 * Layout grid CSS uguale per ogni sorgente; i contenuti sono passati come
 * props o come children via slot opzionali (il consumer rimane logic-less).
 *
 *   ┌───┬──────┬─────────────────────────┬────────────────┬──────────┐
 *   │ ☑ │ 🏳   │ Title row + sub-header  │ City + channels│ Actions  │
 *   │   │ ISO  │                         │ + score        │          │
 *   └───┴──────┴─────────────────────────┴────────────────┴──────────┘
 *     44px  56px         flex (min 0)         200px         96px
 *
 * Striscia verticale 3px a sinistra colorata in base alla `tone`.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { EntityRowFlag } from "./EntityRowFlag";
import { ChannelIcons } from "./ChannelIcons";
import { ScorePill } from "./ScorePill";

export type EntityRowTone = "wca" | "crm" | "bca" | "neutral";

const TONE_STRIPE: Record<EntityRowTone, string> = {
  wca: "bg-gradient-to-b from-primary/80 to-primary/30",
  crm: "bg-gradient-to-b from-chart-2/80 to-chart-2/30",
  bca: "bg-gradient-to-b from-emerald-500/80 to-emerald-500/30",
  neutral: "bg-gradient-to-b from-muted-foreground/40 to-muted-foreground/10",
};

const TONE_BORDER: Record<EntityRowTone, string> = {
  wca: "border-primary/25 hover:border-primary/50",
  crm: "border-chart-2/25 hover:border-chart-2/50",
  bca: "border-emerald-500/25 hover:border-emerald-500/50",
  neutral: "border-border/50 hover:border-border",
};

export interface EntityRowProps {
  tone?: EntityRowTone;
  /** Slot 1 — checkbox (consumer-controlled). */
  checkboxSlot?: React.ReactNode;
  /** Slot 1bis — chevron espansione (opzionale, posto sopra il checkbox). */
  chevronSlot?: React.ReactNode;

  /** Slot 2 — bandiera + ISO (default: <EntityRowFlag />). */
  countryCode?: string | null;

  /** Slot 3a — riga titolo (es. "COMPANY NAME [WCA] [BCA] ✈"). */
  titleSlot: React.ReactNode;
  /** Slot 3b — sub-header sotto al titolo (es. "Mario Rossi · Sales"). */
  subTitleSlot?: React.ReactNode;

  /** Slot 4a — città / location (default: stringa). */
  city?: string | null;
  /** Slot 4b — canali (default: <ChannelIcons /> via channels prop). */
  channels?: { email?: boolean; whatsapp?: boolean; linkedin?: boolean; phone?: boolean; website?: boolean };
  /** Slot 4c — score 0-100 (default: <ScorePill />). */
  score?: number | null;

  /** Slot 5 — azioni a destra (⋯ menu, apri drawer, ecc.). */
  actionsSlot?: React.ReactNode;

  /** Click sull'intera riga (es. apre drawer). */
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function EntityRow({
  tone = "neutral",
  checkboxSlot,
  chevronSlot,
  countryCode,
  titleSlot,
  subTitleSlot,
  city,
  channels,
  score,
  actionsSlot,
  onClick,
  selected,
  className,
}: EntityRowProps): React.ReactElement {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative grid items-center gap-2 px-2 py-2 rounded-lg border bg-card/40 transition-all overflow-hidden",
        "grid-cols-[44px_56px_minmax(0,1fr)_200px_96px]",
        TONE_BORDER[tone],
        selected && "ring-1 ring-primary/40 bg-primary/[0.04]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Striscia colore */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] rounded-l",
          TONE_STRIPE[tone]
        )}
      />

      {/* Col 1: checkbox + chevron */}
      <div
        className="flex items-center justify-center gap-0.5 pl-2"
        onClick={(e) => e.stopPropagation()}
      >
        {chevronSlot}
        {checkboxSlot}
      </div>

      {/* Col 2: bandiera */}
      <div className="flex items-center justify-center">
        <EntityRowFlag countryCode={countryCode} size="lg" />
      </div>

      {/* Col 3: title + sub-title */}
      <div className="flex flex-col min-w-0 gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0 text-sm font-semibold text-foreground">
          {titleSlot}
        </div>
        {subTitleSlot && (
          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 min-w-0">
            {subTitleSlot}
          </div>
        )}
      </div>

      {/* Col 4: città + canali + score */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-[12px] text-foreground/90 truncate font-medium">
          {city || <span className="text-muted-foreground/50 italic">—</span>}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {channels && (
            <ChannelIcons
              email={channels.email}
              whatsapp={channels.whatsapp}
              linkedin={channels.linkedin}
              phone={channels.phone}
              website={channels.website}
              size="sm"
            />
          )}
          <ScorePill value={score ?? null} />
        </div>
      </div>

      {/* Col 5: actions */}
      <div
        className="flex items-center justify-end gap-1 pr-1"
        onClick={(e) => e.stopPropagation()}
      >
        {actionsSlot}
      </div>
    </div>
  );
}

export default EntityRow;