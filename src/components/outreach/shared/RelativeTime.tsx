/**
 * RelativeTime — Mostra "ricevuta 2h fa", "fra 3 giorni", "scaduto da 1g".
 * Tooltip su hover con data+ora completa in italiano.
 */
import { formatDistanceToNow, format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RelativeTimeProps {
  readonly date: string | Date | null | undefined;
  readonly prefix?: string;
  readonly className?: string;
  readonly highlightOverdue?: boolean;
}

export function RelativeTime({ date, prefix, className, highlightOverdue }: RelativeTimeProps) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  const now = Date.now();
  const diffMs = d.getTime() - now;
  const isPast = diffMs < 0;
  const isOverdue = highlightOverdue && isPast;

  const rel = formatDistanceToNow(d, { locale: it, addSuffix: false });
  const text = isPast ? `${rel} fa` : `fra ${rel}`;
  const full = format(d, "dd MMM yyyy 'alle' HH:mm", { locale: it });

  return (
    <span
      title={full}
      className={cn("text-[10px]", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground", className)}
    >
      {prefix ? `${prefix} ` : ""}{text}
    </span>
  );
}

/** Versione assoluta sempre visibile: "24 apr 09:20". */
export function AbsoluteTime({ date, className }: { readonly date: string | Date | null | undefined; readonly className?: string }) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return (
    <span
      title={format(d, "dd MMM yyyy 'alle' HH:mm", { locale: it })}
      className={cn("text-[10px] text-muted-foreground tabular-nums", className)}
    >
      {format(d, "dd MMM HH:mm", { locale: it })}
    </span>
  );
}
