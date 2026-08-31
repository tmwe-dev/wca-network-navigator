/**
 * Tabella standard V3 — l'unica tabella della piattaforma.
 *
 * Regole (valide per OGNI maschera elenco, vedi docs/v3/standard-maschere.md):
 * 1. Nessuna maschera monta `<table>` a mano: si dichiarano le colonne.
 * 2. Click sull'INTESTAZIONE = ordina (asc → desc → asc). Freccia sempre visibile
 *    sulla colonna attiva.
 * 3. Click su un ELEMENTO della cella (badge, paese, azienda…) = aggiunge un
 *    filtro. Chi disegna la cella usa `<V3CellaFiltro>`; la riga non naviga.
 * 4. Click sul resto della riga = apre il dettaglio (se `onRigaClick`).
 * 5. Tutto allineato a sinistra, bordi 1px, stessa altezza di riga.
 */
import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface V3Ordinamento {
  readonly campo: string;
  readonly discendente: boolean;
}

export interface V3Colonna<T> {
  readonly id: string;
  readonly intestazione: React.ReactNode;
  /** Larghezza fissa opzionale (classe Tailwind, es. "w-40"). */
  readonly larghezza?: string;
  /** Colonna nascosta sotto md: usarla per i dettagli secondari. */
  readonly secondaria?: boolean;
  /** Campo di ordinamento server-side. Assente = colonna non ordinabile. */
  readonly ordinaPer?: string;
  readonly cella: (riga: T) => React.ReactNode;
}

export interface V3DataTableProps<T> {
  readonly colonne: readonly V3Colonna<T>[];
  readonly righe: readonly T[];
  readonly chiave: (riga: T) => string;
  readonly onRigaClick?: (riga: T) => void;
  readonly ordinamento?: V3Ordinamento;
  readonly onOrdina?: (campo: string) => void;
  readonly vuoto?: React.ReactNode;
  readonly className?: string;
}

/**
 * Elemento cliccabile dentro una cella: aggiunge un filtro senza aprire la riga.
 * È l'unico modo consentito di rendere filtrabile un valore di tabella.
 */
export function V3CellaFiltro({
  onFiltra,
  attivo,
  titolo,
  children,
  className,
}: {
  readonly onFiltra: () => void;
  readonly attivo?: boolean;
  readonly titolo?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      title={titolo ?? "Filtra per questo valore"}
      onClick={(event) => {
        event.stopPropagation();
        onFiltra();
      }}
      className={cn(
        "max-w-full rounded-md text-left transition-colors hover:bg-accent/20",
        attivo && "ring-1 ring-primary/50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function V3DataTable<T>({
  colonne,
  righe,
  chiave,
  onRigaClick,
  ordinamento,
  onOrdina,
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
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {colonne.map((colonna) => {
                const ordinabile = Boolean(colonna.ordinaPer && onOrdina);
                const attiva = Boolean(colonna.ordinaPer && ordinamento?.campo === colonna.ordinaPer);
                return (
                  <th
                    key={colonna.id}
                    scope="col"
                    aria-sort={attiva ? (ordinamento?.discendente ? "descending" : "ascending") : undefined}
                    className={cn(
                      "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                      colonna.larghezza,
                      colonna.secondaria && "hidden md:table-cell",
                    )}
                  >
                    {ordinabile ? (
                      <button
                        type="button"
                        onClick={() => onOrdina?.(colonna.ordinaPer as string)}
                        className={cn(
                          "flex w-full items-center gap-1 text-left uppercase tracking-wider transition-colors hover:text-foreground",
                          attiva && "text-foreground",
                        )}
                      >
                        <span className="truncate">{colonna.intestazione}</span>
                        {attiva ? (
                          ordinamento?.discendente ? (
                            <ArrowDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ArrowUp className="h-3 w-3 shrink-0" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
                        )}
                      </button>
                    ) : (
                      <span className="block truncate">{colonna.intestazione}</span>
                    )}
                  </th>
                );
              })}
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
