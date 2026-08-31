/**
 * Tabella standard V3 — l'unica tabella della piattaforma.
 *
 * Nessuna maschera deve montare `<table>` a mano: si dichiarano le colonne e
 * si passano le righe. Così ogni lista è identica: stessa altezza di riga,
 * stessi bordi 1px, stesso hover, tutto allineato a sinistra.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface V3Colonna<T> {
  readonly id: string;
  readonly intestazione: React.ReactNode;
  /** Larghezza fissa opzionale (classe Tailwind, es. "w-40"). */
  readonly larghezza?: string;
  /** Colonna nascosta sotto md: usarla per i dettagli secondari. */
  readonly secondaria?: boolean;
  readonly cella: (riga: T) => React.ReactNode;
}

export interface V3DataTableProps<T> {
  readonly colonne: readonly V3Colonna<T>[];
  readonly righe: readonly T[];
  readonly chiave: (riga: T) => string;
  readonly onRigaClick?: (riga: T) => void;
  readonly vuoto?: React.ReactNode;
  readonly className?: string;
}

export function V3DataTable<T>({
  colonne,
  righe,
  chiave,
  onRigaClick,
  vuoto = "Nessun elemento.",
  className,
}: V3DataTableProps<T>): React.ReactElement {
  if (righe.length === 0) {
    return (
      <div className="v3-glass rounded-lg p-8 text-left text-sm text-muted-foreground">{vuoto}</div>
    );
  }

  return (
    <div className={cn("v3-glass overflow-hidden rounded-lg", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {colonne.map((colonna) => (
                <th
                  key={colonna.id}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    colonna.larghezza,
                    colonna.secondaria && "hidden md:table-cell",
                  )}
                >
                  {colonna.intestazione}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.map((riga) => (
              <tr
                key={chiave(riga)}
                onClick={onRigaClick ? () => onRigaClick(riga) : undefined}
                className={cn(
                  "v3-row border-b border-border/60 transition-colors last:border-b-0",
                  onRigaClick && "cursor-pointer",
                )}
              >
                {colonne.map((colonna) => (
                  <td
                    key={colonna.id}
                    className={cn(
                      "px-3 py-2 text-left align-middle",
                      colonna.larghezza,
                      colonna.secondaria && "hidden md:table-cell",
                    )}
                  >
                    {colonna.cella(riga)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default V3DataTable;
