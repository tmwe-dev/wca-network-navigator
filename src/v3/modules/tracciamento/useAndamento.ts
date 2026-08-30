/**
 * Stato della pagina "Andamento": volumi e risposte nel periodo. Sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getAndamentoV3, type V3Andamento } from "@/data/v3/tracciamento";

export const V3_PERIODI_ANDAMENTO = [7, 30, 90] as const;

export interface UseAndamentoResult {
  readonly dati: V3Andamento | null;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly giorni: number;
  readonly setGiorni: (value: number) => void;
  readonly refetch: () => void;
}

export function useAndamento(): UseAndamentoResult {
  const [giorni, setGiorni] = React.useState<number>(30);

  const query = useQuery({
    queryKey: queryKeys.v3.andamento(giorni),
    queryFn: () => getAndamentoV3(giorni),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  return {
    dati: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    giorni,
    setGiorni,
    refetch: () => void query.refetch(),
  };
}
