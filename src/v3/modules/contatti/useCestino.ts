/**
 * Stato della pagina "Cestino": righe soft-deleted. Sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getConteggiCestinoV3,
  listCestinoV3,
  V3_TIPI_CESTINO,
  type V3TipoCestino,
  type V3VoceCestino,
} from "@/data/v3/canaliCestino";

export { V3_TIPI_CESTINO };
export type { V3TipoCestino, V3VoceCestino };

export const V3_PERIODI_CESTINO = [7, 30, 90] as const;

const PER_PAGINA = 25;

export interface UseCestinoResult {
  readonly righe: readonly V3VoceCestino[];
  readonly totale: number;
  readonly pagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly conteggi: Partial<Record<V3TipoCestino, number>>;

  readonly tipo: V3TipoCestino;
  readonly setTipo: (value: V3TipoCestino) => void;
  readonly giorni: number | null;
  readonly setGiorni: (value: number | null) => void;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useCestino(): UseCestinoResult {
  const [tipo, setTipoState] = React.useState<V3TipoCestino>("partners");
  const [giorni, setGiorniState] = React.useState<number | null>(null);
  const [pagina, setPagina] = React.useState(0);

  const filtri = React.useMemo(() => ({ tipo, giorni, pagina, perPagina: PER_PAGINA }), [tipo, giorni, pagina]);

  const query = useQuery({
    queryKey: queryKeys.v3.cestino(filtri),
    queryFn: () => listCestinoV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const conteggi = useQuery({
    queryKey: queryKeys.v3.cestinoConteggi,
    queryFn: getConteggiCestinoV3,
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
    conteggi: conteggi.data ?? {},

    tipo,
    setTipo: (value) => {
      setTipoState(value);
      setPagina(0);
    },
    giorni,
    setGiorni: (value) => {
      setGiorniState(value);
      setPagina(0);
    },

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setTipoState("partners");
      setGiorniState(null);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
