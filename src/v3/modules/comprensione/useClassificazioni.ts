/**
 * Stato della pagina "Qualità classificazione": esiti recenti + sintesi periodo.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getQualitaClassificazioneV3,
  listClassificazioniV3,
  type V3Classificazione,
  type V3QualitaClassificazione,
} from "@/data/v3/comprensione";

const PER_PAGINA = 30;

export const V3_PERIODI = [7, 30, 90] as const;

export interface UseClassificazioniResult {
  readonly righe: readonly V3Classificazione[];
  readonly totale: number;
  readonly pagina: number;
  readonly perPagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;

  readonly qualita: V3QualitaClassificazione | null;
  readonly giorni: number;
  readonly setGiorni: (value: number) => void;
  readonly categoria: string | null;
  readonly setCategoria: (value: string | null) => void;
  readonly soloIncerte: boolean;
  readonly setSoloIncerte: (value: boolean) => void;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useClassificazioni(): UseClassificazioniResult {
  const [giorni, setGiorniState] = React.useState<number>(30);
  const [categoria, setCategoriaState] = React.useState<string | null>(null);
  const [soloIncerte, setSoloIncerteState] = React.useState(false);
  const [pagina, setPagina] = React.useState(0);

  const filtri = React.useMemo(
    () => ({ giorni, categoria, soloIncerte, pagina, perPagina: PER_PAGINA }),
    [giorni, categoria, soloIncerte, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.classificazioni(filtri),
    queryFn: () => listClassificazioniV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const qualita = useQuery({
    queryKey: queryKeys.v3.qualitaClassificazione(giorni),
    queryFn: () => getQualitaClassificazioneV3(giorni),
    staleTime: 60_000,
  });

  const totale = query.data?.totale ?? 0;

  return {
    righe: query.data?.righe ?? [],
    totale,
    pagina,
    perPagina: PER_PAGINA,
    pagineTotali: Math.max(1, Math.ceil(totale / PER_PAGINA)),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,

    qualita: qualita.data ?? null,
    giorni,
    setGiorni: (value) => {
      setGiorniState(value);
      setPagina(0);
    },
    categoria,
    setCategoria: (value) => {
      setCategoriaState(value);
      setPagina(0);
    },
    soloIncerte,
    setSoloIncerte: (value) => {
      setSoloIncerteState(value);
      setPagina(0);
    },

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setGiorniState(30);
      setCategoriaState(null);
      setSoloIncerteState(false);
      setPagina(0);
    },
    refetch: () => {
      void query.refetch();
      void qualita.refetch();
    },
  };
}
