/**
 * KpiStrip — fascia KPI condivisa dell'archetipo Monitor.
 *
 * Puramente presentazionale: nessuna logica, nessun fetch.
 * Regole contratto di pagina: valore `text-sm font-medium`, etichetta
 * `text-[11px] text-muted-foreground`, un solo bordo, un solo raggio.
 * Il colore è neutro salvo `tone` esplicito (stato fuori soglia).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "warning" | "danger" | "accent";

export interface KpiItem {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly tone?: KpiTone;
}

const TONE_CLASS: Record<KpiTone, string> = {
  neutral: "text-foreground",
  accent: "text-primary",
  warning: "text-warning",
  danger: "text-destructive",
};

export function KpiStrip({ items, className }: { readonly items: readonly KpiItem[]; readonly className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn("grid gap-3 grid-cols-2 md:grid-cols-4", className)}>
      {items.map((k) => (
        <div key={k.label} className="rounded-lg border border-border bg-card px-4 py-3">
          <div className={cn("text-lg font-semibold leading-none", TONE_CLASS[k.tone ?? "neutral"])}>{k.value}</div>
          <div className="mt-1.5 text-[11px] text-muted-foreground">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

export default KpiStrip;
