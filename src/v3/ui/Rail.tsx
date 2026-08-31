/**
 * Primitive standard della sidebar V3.
 *
 * Tre soli tipi di controllo, sempre allineati a sinistra:
 * - `RailSezione`  → gruppo apribile (toggle/dropdown della sidebar)
 * - `RailScelte`   → tasti fisici mutuamente esclusivi
 * - `RailSelect`   → tendina per liste lunghe
 * - `RailToggle`   → interruttore acceso/spento
 * Ogni superficie è vetrata, ogni bordo è 1px.
 */
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function RailSezione({
  titolo,
  children,
  apertaDefault = true,
}: {
  readonly titolo: string;
  readonly children: React.ReactNode;
  readonly apertaDefault?: boolean;
}): React.ReactElement {
  const [aperta, setAperta] = React.useState(apertaDefault);
  return (
    <div className="v3-glass rounded-lg">
      <button
        type="button"
        onClick={() => setAperta((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !aperta && "-rotate-90")} />
        <span className="truncate">{titolo}</span>
      </button>
      {aperta && <div className="space-y-1.5 border-t border-border px-2.5 py-2 text-left">{children}</div>}
    </div>
  );
}

export interface RailOpzione {
  readonly valore: string | null;
  readonly etichetta: string;
  readonly conteggio?: number;
}

export function RailScelte({
  opzioni,
  valore,
  onChange,
}: {
  readonly opzioni: readonly RailOpzione[];
  readonly valore: string | null;
  readonly onChange: (valore: string | null) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap justify-start gap-1">
      {opzioni.map((opzione) => {
        const attiva = opzione.valore === valore;
        return (
          <button
            key={opzione.etichetta}
            type="button"
            onClick={() => onChange(opzione.valore)}
            className={cn(
              "rounded-md border px-2 py-1 text-left text-xs transition-colors",
              attiva
                ? "border-primary/60 bg-primary/20 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:border-accent/60 hover:bg-accent/15 hover:text-foreground",
            )}
          >
            {opzione.etichetta}
            {typeof opzione.conteggio === "number" && (
              <span className="ml-1 tabular-nums text-muted-foreground">{opzione.conteggio}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function RailSelect({
  valore,
  onChange,
  opzioni,
  etichettaVuoto,
}: {
  readonly valore: string | null;
  readonly onChange: (valore: string | null) => void;
  readonly opzioni: readonly { readonly valore: string; readonly etichetta: string }[];
  readonly etichettaVuoto: string;
}): React.ReactElement {
  return (
    <select
      value={valore ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className="h-8 w-full rounded-md border border-border bg-background/40 px-2 text-left text-xs text-foreground outline-none focus:border-primary/60"
    >
      <option value="">{etichettaVuoto}</option>
      {opzioni.map((opzione) => (
        <option key={opzione.valore} value={opzione.valore}>
          {opzione.etichetta}
        </option>
      ))}
    </select>
  );
}

export function RailToggle({
  etichetta,
  attivo,
  onChange,
}: {
  readonly etichetta: string;
  readonly attivo: boolean;
  readonly onChange: (attivo: boolean) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={attivo}
      onClick={() => onChange(!attivo)}
      className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full border border-border transition-colors",
          attivo ? "bg-primary/70" : "bg-muted/40",
        )}
      >
        <span
          className={cn(
            "absolute top-[1px] h-3 w-3 rounded-full bg-foreground/90 transition-all",
            attivo ? "left-[13px]" : "left-[1px]",
          )}
        />
      </span>
      <span className="truncate">{etichetta}</span>
    </button>
  );
}

export function RailAzione({
  children,
  onClick,
  icona,
  disabilitato,
}: {
  readonly children: React.ReactNode;
  readonly onClick?: () => void;
  readonly icona?: React.ReactNode;
  readonly disabilitato?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabilitato}
      className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-accent/60 hover:bg-accent/15 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icona}
      <span className="truncate">{children}</span>
    </button>
  );
}
