/**
 * Stato della pagina "Campagne": lotti di invio reali, sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listCampagneV3, type V3Campagna } from "@/data/v3/programmazione";

export const V3_PERIODI_CAMPAGNE = [30, 90, 365] as const;

export interface UseCampagneResult {
  readonly righe: readonly V3Campagna[];
  readonly totaleMessaggi: number;
  readonly totaleInviati: number;
  readonly totaleRisposte: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly giorni: number;
  readonly setGiorni: (value: number) => void;
  readonly selezionata: string | null;
  readonly seleziona: (lotto: string | null) => void;
  readonly refetch: () => void;
}

export function useCampagne(): UseCampagneResult {
  const [giorni, setGiorni] = React.useState<number>(90);
  const [selezionata, setSelezionata] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.v3.campagne(giorni),
    queryFn: () => listCampagneV3(giorni),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const righe = query.data ?? [];

  return {
    righe,
    totaleMessaggi: righe.reduce((sum, r) => sum + r.totale, 0),
    totaleInviati: righe.reduce((sum, r) => sum + r.inviate, 0),
    totaleRisposte: righe.reduce((sum, r) => sum + r.conRisposta, 0),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    giorni,
    setGiorni,
    selezionata,
    seleziona: setSelezionata,
    refetch: () => void query.refetch(),
  };
}
