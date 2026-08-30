/**
 * Stato della pagina "Command": dialogo con il cervello esistente.
 * Nessuna esecuzione di azioni da qui.
 */
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  chiediACommandV3,
  listConversazioniCommandV3,
  type V3CommandMessaggio,
  type V3ConversazioneRecente,
} from "@/data/v3/command";

export type { V3CommandMessaggio, V3ConversazioneRecente };

export interface UseCommandResult {
  readonly messaggi: readonly V3CommandMessaggio[];
  readonly bozza: string;
  readonly setBozza: (value: string) => void;
  readonly invia: () => void;
  readonly isPending: boolean;
  readonly errore: string | null;
  readonly conversazioni: readonly V3ConversazioneRecente[];
  readonly pulisci: () => void;
}

export function useCommand(): UseCommandResult {
  const [messaggi, setMessaggi] = React.useState<readonly V3CommandMessaggio[]>([]);
  const [bozza, setBozza] = React.useState("");
  const [errore, setErrore] = React.useState<string | null>(null);

  const conversazioni = useQuery({
    queryKey: queryKeys.v3.commandConversazioni,
    queryFn: listConversazioniCommandV3,
    staleTime: 60_000,
  });

  const invio = useMutation({
    mutationFn: async (domanda: string) => {
      const storico = messaggi;
      return chiediACommandV3(storico, domanda);
    },
    onSuccess: (risposta) => {
      setMessaggi((prev) => [...prev, { ruolo: "assistant", contenuto: risposta }]);
    },
    onError: (e: unknown) => {
      setErrore(e instanceof Error ? e.message : String(e));
    },
  });

  const invia = React.useCallback(() => {
    const domanda = bozza.trim();
    if (!domanda || invio.isPending) return;
    setErrore(null);
    setMessaggi((prev) => [...prev, { ruolo: "user", contenuto: domanda }]);
    setBozza("");
    invio.mutate(domanda);
  }, [bozza, invio]);

  return {
    messaggi,
    bozza,
    setBozza,
    invia,
    isPending: invio.isPending,
    errore,
    conversazioni: conversazioni.data ?? [],
    pulisci: () => {
      setMessaggi([]);
      setErrore(null);
    },
  };
}
