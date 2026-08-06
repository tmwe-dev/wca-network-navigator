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
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";

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
  /** Colore HEX/HSL del gruppo per il bordo sinistro identificativo della riga. */
  groupColor?: string | null;
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

/**
 * MailAvatar — blocco identità unico a sinistra della card.
 * Mostra il logo aziendale (logo partner → favicon dominio → iniziali) con
 * una bandiera in sovrimpressione nell'angolo. Sostituisce il vecchio mix
 * "bandiera grande + logo duplicato nel brand" che rendeva confusa la card.
 */
function MailAvatar({
  logoUrl,
  fromAddress,
  brand,
  countryCode,
  size,
}: {
  logoUrl?: string | null;
  fromAddress?: string | null;
  brand: string;
  countryCode?: string | null;
  size: number;
}): React.ReactElement {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const flag = countryCode ? countryCodeToFlag(countryCode.trim()) : "";
  const flagSize = Math.max(13, Math.round(size * 0.42));

  if (logoUrl && !logoFailed) {
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          className="h-full w-full rounded-md border border-border/50 bg-background object-contain"
          onError={() => setLogoFailed(true)}
        />
        {flag && (
          <span className="absolute -bottom-1 -right-1 leading-none" style={{ fontSize: flagSize }}>
            {flag}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <CompanyLogo
        email={fromAddress}
        name={brand}
        size={size}
        showFlag={!flag}
        className="rounded-md border border-border/50"
      />
      {flag && (
        <span className="absolute -bottom-1 -right-1 leading-none" style={{ fontSize: flagSize }}>
          {flag}
        </span>
      )}
    </div>
  );
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
  groupColor,
  chips,
  trailing,
  actions,
  onClick,
}: MailRowChromeProps): React.ReactElement {
  const brandText = size === "sm" ? "text-sm" : "text-base";
  const avatarSize = size === "sm" ? 40 : 44;
  return (
    <div
      className={cn(
        "group relative w-full border-b border-border px-3 py-2.5 text-left transition-colors",
        isSelected && "bg-muted",
        !isSelected && isUnread && "bg-primary/5",
        !isSelected && !isUnread && "hover:bg-muted/50",
        inHolding && "border-l-2 border-l-primary",
      )}
      style={groupColor && !inHolding ? { boxShadow: `inset 4px 0 0 0 ${groupColor}` } : undefined}
    >
      <div className="flex w-full items-start gap-2.5">
        <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          {/* Col 1: identità unica — logo + bandiera in un solo blocco. */}
          <MailAvatar
            logoUrl={logoUrl}
            fromAddress={fromAddress}
            brand={brand}
            countryCode={countryCode}
            size={avatarSize}
          />

          {/* Col 2: contenuto allineato su una colonna pulita. */}
          <div className="min-w-0 flex-1 space-y-1">
            {/* Riga 1: brand + data, allineati alla stessa baseline. */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
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
                {inHolding && <Plane className="h-3.5 w-3.5 flex-shrink-0 animate-pulse text-primary" />}
              </div>
              <span className="flex-shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
                {formatMailListDate(date)}
              </span>
            </div>

            {/* Riga 2: mittente. */}
            <p className="truncate text-xs text-muted-foreground">{secondaryLine}</p>

            {/* Riga 3: oggetto. */}
            <p
              className={cn(
                "truncate text-sm",
                isUnread ? "font-semibold text-foreground" : "font-medium text-foreground",
              )}
            >
              {subject}
            </p>

            {/* Riga 4: anteprima corpo. */}
            {previewText && <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{previewText}</p>}

            {/* Riga 5: classificazione (gruppo/suggerito) + chip di stato,
                tutti sulla stessa riga con tipografia uniforme. */}
            {(groupBadge || chips) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 [&>*]:h-5 [&>*]:leading-none">
                {groupBadge}
                {chips}
              </div>
            )}
          </div>
        </button>
        {trailing}
      </div>

      {actions && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
