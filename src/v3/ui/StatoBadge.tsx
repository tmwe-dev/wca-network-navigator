/**
 * Badge di stato standard V3 — unico modo di mostrare uno stato in una lista.
 *
 * `StatoCircuitoBadge` evidenzia sempre il circuito di attesa (holding) con
 * l'accento marrone: in ogni elenco della piattaforma lo stato del circuito
 * deve essere leggibile a colpo d'occhio, mai nascosto.
 */
import * as React from "react";
import { PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { etichettaStato } from "@/v3/modules/contatti/statiLead";

const CLASSI_STATO: Record<string, string> = {
  holding: "border-accent/60 bg-accent/20 text-foreground",
  engaged: "border-primary/50 bg-primary/15 text-foreground",
  negotiation: "border-primary/50 bg-primary/15 text-foreground",
  qualified: "border-primary/50 bg-primary/15 text-foreground",
  converted: "border-primary/60 bg-primary/25 text-foreground",
  blacklisted: "border-destructive/50 bg-destructive/15 text-destructive",
  archived: "border-border bg-muted/20 text-muted-foreground",
};

export interface StatoCircuitoBadgeProps {
  readonly stato: string | null;
}

export function StatoCircuitoBadge({ stato }: StatoCircuitoBadgeProps): React.ReactElement {
  const isHolding = stato === "holding";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none",
        stato ? (CLASSI_STATO[stato] ?? "border-border bg-transparent text-muted-foreground") : "border-border bg-transparent text-muted-foreground",
      )}
    >
      {isHolding && <PauseCircle className="h-3 w-3" aria-hidden />}
      {etichettaStato(stato)}
    </span>
  );
}

export interface InterazioniBadgeProps {
  readonly numero: number;
}

/** Contatore interazioni: 0 è discreto, qualsiasi valore > 0 è evidenziato. */
export function InterazioniBadge({ numero }: InterazioniBadgeProps): React.ReactElement {
  const attivo = numero > 0;
  return (
    <span
      className={cn(
        "inline-flex min-w-8 items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums leading-none",
        attivo
          ? "border-primary/50 bg-primary/15 font-medium text-foreground"
          : "border-border bg-transparent text-muted-foreground",
      )}
      title={`${numero} interazioni`}
    >
      {numero}
    </span>
  );
}
