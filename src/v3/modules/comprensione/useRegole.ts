/**
 * Stato della pagina "Regole e gruppi". Filtri e paginazione server-side.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  listGruppiV3,
  listRegoleV3,
  type V3Gruppo,
  type V3Regola,
} from "@/data/v3/comprensione";

const PER_PAGINA = 40;

export interface UseRegoleResult {
  readonly righe: readonly V3Regola[];
  readonly totale: number;
  readonly pagina: number;
  readonly perPagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;

  readonly gruppi: readonly V3Gruppo[];
  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly gruppoId: string | null;
  readonly setGruppoId: (value: string | null) => void;
  readonly attiva: boolean | null;
  readonly setAttiva: (value: boolean | null) => void;
  readonly soloBloccati: boolean;
  readonly setSoloBloccati: (value: boolean) => void;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useRegole(): UseRegoleResult {
  const [ricercaInput, setRicercaInput] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
  const [gruppoId, setGruppoIdState] = React.useState<string | null>(null);
  const [attiva, setAttivaState] = React.useState<boolean | null>(true);
  const [soloBloccati, setSoloBloccatiState] = React.useState(false);
  const [pagina, setPagina] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setRicerca(ricercaInput);
      setPagina(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ricercaInput]);

  const filtri = React.useMemo(
    () => ({ ricerca, gruppoId, attiva, soloBloccati, pagina, perPagina: PER_PAGINA }),
    [ricerca, gruppoId, attiva, soloBloccati, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.regole(filtri),
    queryFn: () => listRegoleV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const gruppi = useQuery({
    queryKey: queryKeys.v3.gruppiMittenti,
    queryFn: listGruppiV3,
    staleTime: 5 * 60_000,
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

    gruppi: gruppi.data ?? [],
    ricerca: ricercaInput,
    setRicerca: setRicercaInput,
    gruppoId,
    setGruppoId: (value) => {
      setGruppoIdState(value);
      setPagina(0);
    },
    attiva,
    setAttiva: (value) => {
      setAttivaState(value);
      setPagina(0);
    },
    soloBloccati,
    setSoloBloccati: (value) => {
      setSoloBloccatiState(value);
      setPagina(0);
    },

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setRicercaInput("");
      setGruppoIdState(null);
      setAttivaState(true);
      setSoloBloccatiState(false);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
