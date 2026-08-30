/**
 * Stato della pagina "Modelli" (prompt operativi). Sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listModelliV3, type V3Modello } from "@/data/v3/risposta";

const PER_PAGINA = 25;

export interface UseModelliResult {
  readonly righe: readonly V3Modello[];
  readonly totale: number;
  readonly pagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly tagDisponibili: readonly string[];

  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly tag: string | null;
  readonly setTag: (value: string | null) => void;
  readonly attivo: boolean | null;
  readonly setAttivo: (value: boolean | null) => void;

  readonly selezionato: string | null;
  readonly seleziona: (id: string | null) => void;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useModelli(): UseModelliResult {
  const [ricercaInput, setRicercaInput] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
  const [tag, setTagState] = React.useState<string | null>(null);
  const [attivo, setAttivoState] = React.useState<boolean | null>(true);
  const [pagina, setPagina] = React.useState(0);
  const [selezionato, setSelezionato] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setRicerca(ricercaInput);
      setPagina(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ricercaInput]);

  const filtri = React.useMemo(
    () => ({ ricerca, tag, attivo, pagina, perPagina: PER_PAGINA }),
    [ricerca, tag, attivo, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.modelli(filtri),
    queryFn: () => listModelliV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
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
    tagDisponibili: query.data?.tagDisponibili ?? [],

    ricerca: ricercaInput,
    setRicerca: setRicercaInput,
    tag,
    setTag: (value) => {
      setTagState(value);
      setPagina(0);
    },
    attivo,
    setAttivo: (value) => {
      setAttivoState(value);
      setPagina(0);
    },

    selezionato,
    seleziona: setSelezionato,

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setRicercaInput("");
      setTagState(null);
      setAttivoState(true);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
