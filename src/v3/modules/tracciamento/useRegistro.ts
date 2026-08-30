/**
 * Stato della pagina "Registro AI": cosa ha deciso l'AI e perché. Sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listRegistroV3, type V3VoceRegistro } from "@/data/v3/tracciamento";

export type { V3VoceRegistro };

export const V3_PERIODI_REGISTRO = [30, 90, 365] as const;

const PER_PAGINA = 25;

export interface UseRegistroResult {
  readonly righe: readonly V3VoceRegistro[];
  readonly totale: number;
  readonly pagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly tipiDisponibili: readonly { readonly tipo: string; readonly conteggio: number }[];

  readonly giorni: number;
  readonly setGiorni: (value: number) => void;
  readonly tipoDecisione: string | null;
  readonly setTipoDecisione: (value: string | null) => void;
  readonly revisione: string | null;
  readonly setRevisione: (value: string | null) => void;
  readonly soloAutomatiche: boolean;
  readonly setSoloAutomatiche: (value: boolean) => void;
  readonly aperta: string | null;
  readonly apri: (id: string | null) => void;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useRegistro(): UseRegistroResult {
  const [giorni, setGiorniState] = React.useState<number>(365);
  const [tipoDecisione, setTipoState] = React.useState<string | null>(null);
  const [revisione, setRevisioneState] = React.useState<string | null>(null);
  const [soloAutomatiche, setSoloAutomaticheState] = React.useState(false);
  const [pagina, setPagina] = React.useState(0);
  const [aperta, setAperta] = React.useState<string | null>(null);

  const filtri = React.useMemo(
    () => ({ giorni, tipoDecisione, revisione, soloAutomatiche, pagina, perPagina: PER_PAGINA }),
    [giorni, tipoDecisione, revisione, soloAutomatiche, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.registro(filtri),
    queryFn: () => listRegistroV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const totale = query.data?.totale ?? 0;
  const reset = () => setPagina(0);

  return {
    righe: query.data?.righe ?? [],
    totale,
    pagina,
    pagineTotali: Math.max(1, Math.ceil(totale / PER_PAGINA)),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    tipiDisponibili: query.data?.tipiDisponibili ?? [],

    giorni,
    setGiorni: (value) => {
      setGiorniState(value);
      reset();
    },
    tipoDecisione,
    setTipoDecisione: (value) => {
      setTipoState(value);
      reset();
    },
    revisione,
    setRevisione: (value) => {
      setRevisioneState(value);
      reset();
    },
    soloAutomatiche,
    setSoloAutomatiche: (value) => {
      setSoloAutomaticheState(value);
      reset();
    },
    aperta,
    apri: setAperta,

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setGiorniState(365);
      setTipoState(null);
      setRevisioneState(null);
      setSoloAutomaticheState(false);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
