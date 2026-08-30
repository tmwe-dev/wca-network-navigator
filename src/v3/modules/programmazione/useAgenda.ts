/**
 * Stato della pagina "Agenda". Sola lettura sulla finestra temporale scelta.
 */
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listAgendaV3, type V3VoceAgenda } from "@/data/v3/programmazione";

export const V3_FINESTRE = [1, 7, 30] as const;

export const V3_TIPI_ATTIVITA = [
  "send_email",
  "phone_call",
  "add_to_campaign",
  "meeting",
  "follow_up",
  "whatsapp_message",
  "linkedin_message",
  "other",
] as const;

export interface UseAgendaResult {
  readonly voci: readonly V3VoceAgenda[];
  readonly scadute: readonly V3VoceAgenda[];
  readonly oggi: readonly V3VoceAgenda[];
  readonly prossime: readonly V3VoceAgenda[];
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;

  readonly giorni: number;
  readonly setGiorni: (value: number) => void;
  readonly tipo: string | null;
  readonly setTipo: (value: string | null) => void;
  readonly stato: string | null;
  readonly setStato: (value: string | null) => void;
  readonly soloScadute: boolean;
  readonly setSoloScadute: (value: boolean) => void;

  readonly azzeraFiltri: () => void;
  readonly refetch: () => void;
}

export function useAgenda(): UseAgendaResult {
  const [giorni, setGiorni] = React.useState<number>(7);
  const [tipo, setTipo] = React.useState<string | null>(null);
  const [stato, setStato] = React.useState<string | null>("pending");
  const [soloScadute, setSoloScadute] = React.useState(false);

  const filtri = React.useMemo(() => ({ giorni, tipo, stato, soloScadute }), [giorni, tipo, stato, soloScadute]);

  const query = useQuery({
    queryKey: queryKeys.v3.agenda(filtri),
    queryFn: () => listAgendaV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const voci = query.data ?? [];
  const oggiIso = new Date().toISOString().slice(0, 10);

  return {
    voci,
    scadute: voci.filter((v) => v.scadenza !== null && v.scadenza < oggiIso),
    oggi: voci.filter((v) => v.scadenza === oggiIso),
    prossime: voci.filter((v) => v.scadenza === null || v.scadenza > oggiIso),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,

    giorni,
    setGiorni,
    tipo,
    setTipo,
    stato,
    setStato,
    soloScadute,
    setSoloScadute,

    azzeraFiltri: () => {
      setGiorni(7);
      setTipo(null);
      setStato("pending");
      setSoloScadute(false);
    },
    refetch: () => void query.refetch(),
  };
}
