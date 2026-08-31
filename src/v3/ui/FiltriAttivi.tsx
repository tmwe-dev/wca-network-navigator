/**
 * Barra dei filtri attivi — standard V3.
 *
 * Sta SOPRA la tabella (e sopra l'elenco della sidebar sinistra). Ogni filtro è
 * un badge con la X per toglierlo; l'ultima azione è "Azzera tutto".
 * Se non ci sono filtri la barra non occupa spazio.
 */
import * as React from "react";
import { X } from "lucide-react";
import { chiaveFiltro, type V3Filtro } from "./filtri";

export function V3FiltriAttivi({
  filtri,
  onRimuovi,
  onAzzera,
  compatto = false,
}: {
  readonly filtri: readonly V3Filtro[];
  readonly onRimuovi: (filtro: V3Filtro) => void;
  readonly onAzzera: () => void;
  /** Versione per la sidebar: badge a piena larghezza, uno per riga. */
  readonly compatto?: boolean;
}): React.ReactElement | null {
  if (filtri.length === 0) return null;

  return (
    <div className={compatto ? "flex flex-col items-start gap-1" : "flex flex-wrap items-center gap-1.5"}>
      {filtri.map((filtro) => (
        <span
          key={chiaveFiltro(filtro)}
          className={`inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-2 py-0.5 text-[11px] leading-none text-foreground ${
            compatto ? "w-full" : ""
          }`}
        >
          <span className="truncate">{filtro.etichetta}</span>
          <button
            type="button"
            aria-label={`Rimuovi filtro ${filtro.etichetta}`}
            onClick={() => onRimuovi(filtro)}
            className="ml-auto shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onAzzera}
        className={`rounded-md border border-border px-2 py-0.5 text-[11px] leading-none text-muted-foreground transition-colors hover:border-accent/60 hover:text-foreground ${
          compatto ? "w-full text-left" : ""
        }`}
      >
        Azzera tutto
      </button>
    </div>
  );
}

export default V3FiltriAttivi;
