/**
 * Stato della pagina "Approvazioni". Filtri e paginazione server-side.
 * Il rifiuto è l'unica scrittura: non parte alcun invio da questa maschera.
 */
import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  approvaEdEseguiV3,
  getSintesiApprovazioniV3,
  listApprovazioniV3,
  rifiutaApprovazioneV3,
  type V3Approvazione,
  type V3SintesiApprovazioni,
} from "@/data/v3/risposta";

const PER_PAGINA = 25;

export const V3_STATI_APPROVAZIONE = ["pending", "approved", "executed", "failed", "rejected"] as const;

export interface UseApprovazioniResult {
  readonly righe: readonly V3Approvazione[];
  readonly totale: number;
  readonly pagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly sintesi: V3SintesiApprovazioni | null;

  readonly stato: string;
  readonly setStato: (value: string) => void;
  readonly tipoAzione: string | null;
  readonly setTipoAzione: (value: string | null) => void;
  readonly rischio: string | null;
  readonly setRischio: (value: string | null) => void;

  readonly selezionata: string | null;
  readonly seleziona: (id: string | null) => void;
  readonly rifiuta: (id: string) => void;
  readonly isRifiutando: boolean;

  readonly vaiA: (pagina: number) => void;
  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useApprovazioni(): UseApprovazioniResult {
  const queryClient = useQueryClient();
  const [stato, setStatoState] = React.useState<string>("pending");
  const [tipoAzione, setTipoAzioneState] = React.useState<string | null>(null);
  const [rischio, setRischioState] = React.useState<string | null>(null);
  const [pagina, setPagina] = React.useState(0);
  const [selezionata, setSelezionata] = React.useState<string | null>(null);

  const filtri = React.useMemo(
    () => ({ stato, tipoAzione, rischio, pagina, perPagina: PER_PAGINA }),
    [stato, tipoAzione, rischio, pagina],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.approvazioni(filtri),
    queryFn: () => listApprovazioniV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const sintesi = useQuery({
    queryKey: queryKeys.v3.sintesiApprovazioni(stato),
    queryFn: () => getSintesiApprovazioniV3(stato),
    staleTime: 60_000,
  });

  const rifiuto = useMutation({
    mutationFn: (id: string) => rifiutaApprovazioneV3(id),
    onSuccess: () => {
      setSelezionata(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.v3.approvazioni(filtri) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.v3.sintesiApprovazioni(stato) });
    },
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
    sintesi: sintesi.data ?? null,

    stato,
    setStato: (value) => {
      setStatoState(value);
      setPagina(0);
      setSelezionata(null);
    },
    tipoAzione,
    setTipoAzione: (value) => {
      setTipoAzioneState(value);
      setPagina(0);
    },
    rischio,
    setRischio: (value) => {
      setRischioState(value);
      setPagina(0);
    },

    selezionata,
    seleziona: setSelezionata,
    rifiuta: (id) => rifiuto.mutate(id),
    isRifiutando: rifiuto.isPending,

    vaiA: (value) => setPagina(Math.max(0, value)),
    azzeraFiltri: () => {
      setStatoState("pending");
      setTipoAzioneState(null);
      setRischioState(null);
      setPagina(0);
    },
    refetch: () => void query.refetch(),
  };
}
