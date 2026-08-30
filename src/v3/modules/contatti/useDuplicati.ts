/**
 * Stato della pagina "Duplicati". Sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listDuplicatiV3, type V3GruppoDuplicati, type V3TipoDuplicato } from "@/data/v3/duplicati";

export type { V3GruppoDuplicati, V3TipoDuplicato };

export const V3_SOGLIE_DUPLICATI = [2, 3, 5] as const;

export interface UseDuplicatiResult {
  readonly gruppi: readonly V3GruppoDuplicati[];
  readonly campione: number;
  readonly righeCoinvolte: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;

  readonly tipo: V3TipoDuplicato;
  readonly setTipo: (value: V3TipoDuplicato) => void;
  readonly soglia: number;
  readonly setSoglia: (value: number) => void;
  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly aperto: string | null;
  readonly apri: (chiave: string | null) => void;

  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useDuplicati(): UseDuplicatiResult {
  const [tipo, setTipo] = React.useState<V3TipoDuplicato>("email");
  const [soglia, setSoglia] = React.useState<number>(2);
  const [input, setInput] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
  const [aperto, setAperto] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setRicerca(input), 350);
    return () => window.clearTimeout(timer);
  }, [input]);

  const filtri = React.useMemo(() => ({ tipo, soglia, ricerca }), [tipo, soglia, ricerca]);

  const query = useQuery({
    queryKey: queryKeys.v3.duplicati(filtri),
    queryFn: () => listDuplicatiV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  return {
    gruppi: query.data?.gruppi ?? [],
    campione: query.data?.campione ?? 0,
    righeCoinvolte: query.data?.righeCoinvolte ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,

    tipo,
    setTipo,
    soglia,
    setSoglia,
    ricerca: input,
    setRicerca: setInput,
    aperto,
    apri: setAperto,

    azzeraFiltri: () => {
      setTipo("email");
      setSoglia(2);
      setInput("");
    },
    refetch: () => void query.refetch(),
  };
}
