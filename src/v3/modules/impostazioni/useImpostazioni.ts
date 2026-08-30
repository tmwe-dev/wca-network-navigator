/**
 * Stato della pagina "Impostazioni". Sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getImpostazioniV3, type V3Impostazioni } from "@/data/v3/impostazioni";

export type { V3Impostazioni };

export interface UseImpostazioniResult {
  readonly dati: V3Impostazioni | null;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly ricercaChiave: string;
  readonly setRicercaChiave: (value: string) => void;
  readonly refetch: () => void;
}

export function useImpostazioni(): UseImpostazioniResult {
  const [input, setInput] = React.useState("");
  const [ricercaChiave, setRicercaChiave] = React.useState("");

  React.useEffect(() => {
    const timer = window.setTimeout(() => setRicercaChiave(input), 350);
    return () => window.clearTimeout(timer);
  }, [input]);

  const query = useQuery({
    queryKey: queryKeys.v3.impostazioni(ricercaChiave),
    queryFn: () => getImpostazioniV3(ricercaChiave),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  return {
    dati: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    ricercaChiave: input,
    setRicercaChiave: setInput,
    refetch: () => void query.refetch(),
  };
}
