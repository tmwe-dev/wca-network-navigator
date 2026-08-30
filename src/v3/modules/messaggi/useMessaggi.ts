/**
 * Stato della Inbox. Filtri e paginazione server-side.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  listCaselleV3,
  listMessaggiV3,
  type V3Casella,
  type V3Direzione,
  type V3MessaggioRiga,
} from "@/data/v3/messaggi";

const PER_PAGINA = 40;

export interface UseMessaggiResult {
  readonly righe: readonly V3MessaggioRiga[];
  readonly totale: number;
  readonly pagina: number;
  readonly perPagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;

  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly canale: string | null;
  readonly setCanale: (value: string | null) => void;
  readonly casellaId: string | null;
  readonly setCasellaId: (value: string | null) => void;
  readonly direzione: V3Direzione | null;
  readonly setDirezione: (value: V3Direzione | null) => void;
  readonly soloNonLetti: boolean;
  readonly setSoloNonLetti: (value: boolean) => void;
  readonly caselle: readonly V3Casella[];

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useMessaggi(): UseMessaggiResult {
  const [ricercaInput, setRicercaInput] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
  const [canale, setCanaleState] = React.useState<string | null>(null);
  const [casellaId, setCasellaIdState] = React.useState<string | null>(null);
  const [direzione, setDirezioneState] = React.useState<V3Direzione | null>("inbound");
  const [soloNonLetti, setSoloNonLettiState] = React.useState(false);
  const [pagina, setPagina] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setRicerca(ricercaInput);
      setPagina(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ricercaInput]);

  const filtri = React.useMemo(
    () => ({ ricerca, canale, casellaId, direzione, soloNonLetti, pagina, perPagina: PER_PAGINA }),
    [ricerca, canale, casellaId, direzione, soloNonLetti, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.messaggi(filtri),
    queryFn: () => listMessaggiV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const caselle = useQuery({
    queryKey: queryKeys.v3.caselle,
    queryFn: listCaselleV3,
    staleTime: 10 * 60_000,
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

    ricerca: ricercaInput,
    setRicerca: setRicercaInput,
    canale,
    setCanale: (value) => {
      setCanaleState(value);
      setPagina(0);
    },
    casellaId,
    setCasellaId: (value) => {
      setCasellaIdState(value);
      setPagina(0);
    },
    direzione,
    setDirezione: (value) => {
      setDirezioneState(value);
      setPagina(0);
    },
    soloNonLetti,
    setSoloNonLetti: (value) => {
      setSoloNonLettiState(value);
      setPagina(0);
    },
    caselle: caselle.data ?? [],

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setRicercaInput("");
      setCanaleState(null);
      setCasellaIdState(null);
      setDirezioneState("inbound");
      setSoloNonLettiState(false);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
