/**
 * MailRowChrome — chrome canonica per riga email.
 *
 * Struttura comune estratta da `EmailMessageList` (Inbox principale) e
 * `FunnemailMailCard` (Funnemail). Mantiene la stessa gerarchia visiva:
 *   logo • brand + bandiera + data
 *         oggetto
 *         mittente
 *         [chips slot] [trailing slot]
 *
 * Tutti i comportamenti specifici (claim, reminder, decisioni AI, gruppi)
 * restano nei componenti consumatori via slot.
 */
import * as React from "react";
import { Plane } from "lucide-react";
import { CompanyLogoInline } from "@/components/ui/CompanyLogo";
import { cn } from "@/lib/utils";
import { EntityRowFlag } from "@/v2/ui/atoms/EntityRowFlag";

export interface MailRowChromeProps {
  fromAddress: string | null | undefined;
  brand: string;
  subject: string;
  secondaryLine: string;
  date: string;
  isUnread: boolean;
  isSelected: boolean;
  inHolding: boolean;
  countryCode?: string | null;
  countryName?: string | null;
  logoUrl?: string | null;
  size?: "sm" | "md";
  /** Anteprima testo del corpo (2 righe). */
  previewText?: string | null;
  /** Badge gruppo (assegnato o suggerito) mostrato sopra l'orario, in alto a destra. */
  groupBadge?: React.ReactNode;
  /** Chip riga (gruppo, AI, decisione, status…) */
  chips?: React.ReactNode;
  /** Trailing icone/bottoni (claim, mark-read…) */
  trailing?: React.ReactNode;
  /** Toolbar azioni in fondo */
  actions?: React.ReactNode;
  onClick?: () => void;
}

export function formatMailListDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

export function MailRowChrome({
  fromAddress,
  brand,
  subject,
  secondaryLine,
  date,
  isUnread,
  isSelected,
  inHolding,
  countryCode,
  countryName,
  logoUrl,
  size = "md",
  previewText,
  groupBadge,
  chips,
  trailing,
  actions,
  onClick,
}: MailRowChromeProps): React.ReactElement {
  const brandText = size === "sm" ? "text-sm" : "text-base";
  return (
    <div
      className={cn(
        "group relative w-full border-b border-border px-3 py-2.5 text-left transition-colors",
        isSelected && "bg-muted",
        !isSelected && isUnread && "bg-primary/5",
        !isSelected && !isUnread && "hover:bg-muted/50",
        inHolding && "border-l-2 border-l-primary",
      )}
    >
      <div className="flex w-full items-start gap-2.5">
        <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          {/* Col 1: bandiera grande + ISO sotto (template canonico app) */}
          <div className="mt-0.5 flex-shrink-0 w-[44px] flex items-start justify-center">
            <EntityRowFlag countryCode={countryCode ?? null} size={size === "sm" ? "md" : "lg"} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt=""
                      loading="lazy"
                      className="h-4 w-4 rounded-sm object-contain bg-background border border-border/40 flex-shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <span
                    className={cn(
                      "truncate font-semibold uppercase tracking-wide",
                      brandText,
                      isUnread ? "text-primary" : "text-foreground",
                    )}
                    title={countryName ?? undefined}
                  >
                    {brand}
                  </span>
                  <CompanyLogoInline email={fromAddress} size={size === "sm" ? 16 : 18} />
                  {inHolding && <Plane className="h-3.5 w-3.5 animate-pulse text-primary" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">{secondaryLine}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                {groupBadge}
                <span className="text-xs font-medium text-foreground">{formatMailListDate(date)}</span>
              </div>
            </div>

            <p
              className={cn(
                "truncate text-sm",
                isUnread ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {subject}
            </p>

            {previewText && (
              <p className="line-clamp-2 text-xs leading-snug text-muted-foreground/85">
                {previewText}
              </p>
            )}

            {chips && <div className="flex flex-wrap items-center gap-1.5">{chips}</div>}
          </div>
        </button>
        {trailing}
      </div>

      {actions && (
        <div
          className="mt-2 flex flex-wrap items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}