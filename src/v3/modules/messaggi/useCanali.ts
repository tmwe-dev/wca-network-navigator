/**
 * Stato della pagina "Canali": conversazioni WhatsApp/LinkedIn. Sola lettura.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  listConversazioniCanaliV3,
  V3_CANALI_NON_EMAIL,
  type V3Conversazione,
} from "@/data/v3/canaliCestino";

export { V3_CANALI_NON_EMAIL };
export type { V3Conversazione };

export const V3_PERIODI_CANALI = [30, 90, 365] as const;

export interface UseCanaliResult {
  readonly conversazioni: readonly V3Conversazione[];
  readonly perCanale: readonly { readonly canale: string; readonly conteggio: number }[];
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;

  readonly canale: string | null;
  readonly setCanale: (value: string | null) => void;
  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly giorni: number;
  readonly setGiorni: (value: number) => void;
  readonly aperta: string | null;
  readonly apri: (chiave: string | null) => void;

  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useCanali(): UseCanaliResult {
  const [canale, setCanale] = React.useState<string | null>(null);
  const [ricercaInput, setRicercaInput] = React.useState("");
  const [ricerca, setRicerca] = React.useState("");
  const [giorni, setGiorni] = React.useState<number>(365);
  const [aperta, setAperta] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setRicerca(ricercaInput), 350);
    return () => window.clearTimeout(timer);
  }, [ricercaInput]);

  const filtri = React.useMemo(() => ({ canale, ricerca, giorni }), [canale, ricerca, giorni]);

  const query = useQuery({
    queryKey: queryKeys.v3.canali(filtri),
    queryFn: () => listConversazioniCanaliV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  return {
    conversazioni: query.data?.conversazioni ?? [],
    perCanale: query.data?.perCanale ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,

    canale,
    setCanale,
    ricerca: ricercaInput,
    setRicerca: setRicercaInput,
    giorni,
    setGiorni,
    aperta,
    apri: setAperta,

    azzeraFiltri: () => {
      setCanale(null);
      setRicercaInput("");
      setGiorni(365);
    },
    refetch: () => void query.refetch(),
  };
}
