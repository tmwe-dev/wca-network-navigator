/**
 * Stato della pagina "Pipeline": partner per fase di relazione. Sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getFasiPipelineV3,
  listPipelineV3,
  V3_ETICHETTA_FASE,
  V3_FASI_PIPELINE,
  type V3FaseConteggio,
  type V3VocePipeline,
} from "@/data/v3/tracciamento";

export { V3_ETICHETTA_FASE, V3_FASI_PIPELINE };
export type { V3VocePipeline };

const PER_PAGINA = 25;

export interface UsePipelineResult {
  readonly righe: readonly V3VocePipeline[];
  readonly totale: number;
  readonly pagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly fasi: readonly V3FaseConteggio[];

  readonly fase: string;
  readonly setFase: (value: string) => void;
  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly selezionato: string | null;
  readonly seleziona: (id: string | null) => void;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function usePipeline(): UsePipelineResult {
  const [fase, setFaseState] = React.useState<string>("engaged");
  const [ricercaInput, setRicercaInput] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
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
    () => ({ fase, ricerca, pagina, perPagina: PER_PAGINA }),
    [fase, ricerca, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.pipeline(filtri),
    queryFn: () => listPipelineV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const fasi = useQuery({
    queryKey: queryKeys.v3.pipelineFasi,
    queryFn: getFasiPipelineV3,
    staleTime: 5 * 60_000,
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
    fasi: fasi.data ?? [],

    fase,
    setFase: (value) => {
      setFaseState(value);
      setPagina(0);
      setSelezionato(null);
    },
    ricerca: ricercaInput,
    setRicerca: setRicercaInput,
    selezionato,
    seleziona: setSelezionato,

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setFaseState("engaged");
      setRicercaInput("");
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
