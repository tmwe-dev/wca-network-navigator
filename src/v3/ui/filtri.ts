/**
 * Modello unico dei filtri delle maschere elenco V3.
 *
 * Un filtro è sempre la coppia (campo, valore) più un'etichetta leggibile.
 * Più valori sullo stesso campo si sommano in OR; campi diversi si sommano in AND.
 * Clic su un elemento = `alternaFiltro`. Clic sulla X del badge = `rimuoviFiltro`.
 */

export interface V3Filtro {
  readonly campo: string;
  readonly valore: string;
  /** Testo mostrato nel badge, es. "Paese: Italia". */
  readonly etichetta: string;
}

export function chiaveFiltro(filtro: V3Filtro): string {
  return `${filtro.campo}::${filtro.valore}`;
}

export function filtroAttivo(filtri: readonly V3Filtro[], campo: string, valore: string): boolean {
  return filtri.some((f) => f.campo === campo && f.valore === valore);
}

/** Aggiunge il filtro se assente, lo toglie se già presente. */
export function alternaFiltro(filtri: readonly V3Filtro[], filtro: V3Filtro): V3Filtro[] {
  return filtroAttivo(filtri, filtro.campo, filtro.valore)
    ? filtri.filter((f) => chiaveFiltro(f) !== chiaveFiltro(filtro))
    : [...filtri, filtro];
}

export function rimuoviFiltro(filtri: readonly V3Filtro[], filtro: V3Filtro): V3Filtro[] {
  return filtri.filter((f) => chiaveFiltro(f) !== chiaveFiltro(filtro));
}

/** Valori attivi di un campo, nell'ordine in cui sono stati aggiunti. */
export function valoriDi(filtri: readonly V3Filtro[], campo: string): string[] {
  return filtri.filter((f) => f.campo === campo).map((f) => f.valore);
}
