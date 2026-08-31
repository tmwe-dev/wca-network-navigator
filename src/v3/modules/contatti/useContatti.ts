/**
 * Stato dell'anagrafica unificata: contatti CRM, biglietti da visita e partner WCA.
 * Filtri e paginazione sono server-side (funzione SQL `v3_directory`).
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  listAnagraficaV3,
  listPaesiAnagraficaV3,
  type V3AnagraficaRiga,
  type V3FonteAnagrafica,
} from "@/data/v3/anagrafiche";

const PER_PAGINA = 50;

export interface UseContattiResult {
  readonly righe: readonly V3AnagraficaRiga[];
  readonly totale: number;
  readonly pagina: number;
  readonly perPagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;

  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly fonte: V3FonteAnagrafica | null;
  readonly setFonte: (value: V3FonteAnagrafica | null) => void;
  readonly paese: string | null;
  readonly setPaese: (value: string | null) => void;
  readonly stato: string | null;
  readonly setStato: (value: string | null) => void;
  readonly soloConEmail: boolean;
  readonly setSoloConEmail: (value: boolean) => void;
  readonly paesiDisponibili: readonly string[];

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useContatti(): UseContattiResult {
  const [ricercaInput, setRicercaInput] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
  const [fonte, setFonteState] = React.useState<V3FonteAnagrafica | null>(null);
  const [paese, setPaeseState] = React.useState<string | null>(null);
  const [stato, setStatoState] = React.useState<string | null>(null);
  const [soloConEmail, setSoloConEmailState] = React.useState(false);
  const [pagina, setPagina] = React.useState(0);

  // Debounce: la ricerca colpisce il database, non un array già in memoria.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setRicerca(ricercaInput);
      setPagina(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ricercaInput]);

  const filtri = React.useMemo(
    () => ({ ricerca, fonte, paese, stato, soloConEmail, pagina, perPagina: PER_PAGINA }),
    [ricerca, fonte, paese, stato, soloConEmail, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.anagrafica(filtri),
    queryFn: () => listAnagraficaV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const paesi = useQuery({
    queryKey: queryKeys.v3.anagraficaPaesi,
    queryFn: listPaesiAnagraficaV3,
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
    fonte,
    setFonte: (value) => {
      setFonteState(value);
      setPagina(0);
    },
    paese,
    setPaese: (value) => {
      setPaeseState(value);
      setPagina(0);
    },
    stato,
    setStato: (value) => {
      setStatoState(value);
      setPagina(0);
    },
    soloConEmail,
    setSoloConEmail: (value) => {
      setSoloConEmailState(value);
      setPagina(0);
    },
    paesiDisponibili: paesi.data ?? [],

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setRicercaInput("");
      setFonteState(null);
      setPaeseState(null);
      setStatoState(null);
      setSoloConEmailState(false);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
