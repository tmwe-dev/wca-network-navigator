/**
 * Stato della pagina "Coda di invio". Sola lettura: riprova e sblocco toccano
 * la pipeline di invio e restano fuori dalla V3 per ora.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listCodaV3, type V3VoceCoda } from "@/data/v3/programmazione";

const PER_PAGINA = 25;

export interface UseCodaResult {
  readonly righe: readonly V3VoceCoda[];
  readonly totale: number;
  readonly pagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly statiDisponibili: readonly { readonly stato: string; readonly conteggio: number }[];

  readonly stato: string | null;
  readonly setStato: (value: string | null) => void;
  readonly soloErrori: boolean;
  readonly setSoloErrori: (value: boolean) => void;
  readonly selezionata: string | null;
  readonly seleziona: (id: string | null) => void;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useCoda(): UseCodaResult {
  const [stato, setStatoState] = React.useState<string | null>(null);
  const [soloErrori, setSoloErroriState] = React.useState(false);
  const [pagina, setPagina] = React.useState(0);
  const [selezionata, setSelezionata] = React.useState<string | null>(null);

  const filtri = React.useMemo(
    () => ({ stato, soloErrori, pagina, perPagina: PER_PAGINA }),
    [stato, soloErrori, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.coda(filtri),
    queryFn: () => listCodaV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const totale = query.data?.totale ?? 0;

  return {
    righe: query.data?.righe ?? [],
    totale,
    pagina,
    pagineTotali: Math.max(1, Math.ceil(totale / PER_PAGINA)),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    statiDisponibili: query.data?.statiDisponibili ?? [],

    stato,
    setStato: (value) => {
      setStatoState(value);
      setPagina(0);
    },
    soloErrori,
    setSoloErrori: (value) => {
      setSoloErroriState(value);
      setPagina(0);
    },
    selezionata,
    seleziona: setSelezionata,

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setStatoState(null);
      setSoloErroriState(false);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
