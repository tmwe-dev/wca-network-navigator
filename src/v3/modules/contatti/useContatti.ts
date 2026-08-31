/**
 * Stato dell'anagrafica unificata: contatti CRM, biglietti da visita e partner WCA.
 *
 * Modello standard V3: una sola lista di filtri (campo, valore) più un solo
 * ordinamento. Filtri e paginazione sono server-side (funzione SQL `v3_directory`).
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  listAnagraficaV3,
  listPaesiAnagraficaV3,
  type V3AnagraficaRiga,
  type V3OrdineAnagrafica,
} from "@/data/v3/anagrafiche";
import { alternaFiltro, rimuoviFiltro as rimuovi, valoriDi, type V3Filtro } from "@/v3/ui/filtri";
import type { V3Ordinamento } from "@/v3/ui/DataTable";

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
  readonly filtri: readonly V3Filtro[];
  readonly alterna: (filtro: V3Filtro) => void;
  readonly rimuoviFiltro: (filtro: V3Filtro) => void;
  readonly soloConEmail: boolean;
  readonly setSoloConEmail: (value: boolean) => void;
  readonly paesiDisponibili: readonly string[];

  readonly ordinamento: V3Ordinamento;
  readonly ordinaPer: (campo: string) => void;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useContatti(): UseContattiResult {
  const [ricercaInput, setRicercaInput] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
  const [filtri, setFiltri] = React.useState<readonly V3Filtro[]>([]);
  const [soloConEmail, setSoloConEmailState] = React.useState(false);
  const [ordinamento, setOrdinamento] = React.useState<V3Ordinamento>({
    campo: "recente",
    discendente: true,
  });
  const [pagina, setPagina] = React.useState(0);

  // Debounce: la ricerca colpisce il database, non un array già in memoria.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setRicerca(ricercaInput);
      setPagina(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ricercaInput]);

  const parametri = React.useMemo(
    () => ({
      ricerca,
      fonti: valoriDi(filtri, "fonte"),
      paesi: valoriDi(filtri, "paese"),
      stati: valoriDi(filtri, "stato"),
      aziende: valoriDi(filtri, "azienda"),
      soloConEmail,
      ordine: ordinamento.campo as V3OrdineAnagrafica,
      discendente: ordinamento.discendente,
      pagina,
      perPagina: PER_PAGINA,
    }),
    [ricerca, filtri, soloConEmail, ordinamento, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.anagrafica(parametri),
    queryFn: () => listAnagraficaV3(parametri),
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
    filtri,
    alterna: (filtro) => {
      setFiltri((correnti) => alternaFiltro(correnti, filtro));
      setPagina(0);
    },
    rimuoviFiltro: (filtro) => {
      setFiltri((correnti) => rimuovi(correnti, filtro));
      setPagina(0);
    },
    soloConEmail,
    setSoloConEmail: (value) => {
      setSoloConEmailState(value);
      setPagina(0);
    },
    paesiDisponibili: paesi.data ?? [],

    ordinamento,
    ordinaPer: (campo) => {
      setOrdinamento((corrente) =>
        corrente.campo === campo
          ? { campo, discendente: !corrente.discendente }
          : { campo, discendente: campo === "recente" || campo === "interazioni" },
      );
      setPagina(0);
    },

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setRicercaInput("");
      setFiltri([]);
      setSoloConEmailState(false);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}

/** Costanti e tipi dell'anagrafica esposti alle maschere (che non toccano il DAL). */
export {
  ETICHETTE_FONTE,
  V3_FONTI_ANAGRAFICA,
  type V3AnagraficaRiga,
  type V3FonteAnagrafica,
} from "@/data/v3/anagrafiche";

/** Persone di una singola azienda: alimenta il popup «Scheda azienda». */
export function usePersoneAzienda(azienda: string | null): {
  readonly righe: readonly V3AnagraficaRiga[];
  readonly isLoading: boolean;
} {
  const chiave = (azienda ?? "").trim().toLowerCase();
  const parametri = React.useMemo(
    () => ({
      aziende: chiave ? [chiave] : [],
      ordine: "nome" as const,
      discendente: false,
      pagina: 0,
      perPagina: 100,
    }),
    [chiave],
  );
  const query = useQuery({
    queryKey: queryKeys.v3.anagrafica(parametri),
    queryFn: () => listAnagraficaV3(parametri),
    enabled: Boolean(chiave),
    staleTime: 30_000,
  });
  return { righe: query.data?.righe ?? [], isLoading: query.isLoading };
}
