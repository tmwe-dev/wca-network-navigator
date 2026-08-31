/**
 * Stato della pagina "Command": dialogo con il cervello esistente.
 * Nessuna esecuzione di azioni da qui: la conversazione viene però
 * salvata (ai_conversations, contesto `v3/command`) e può essere riaperta.
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  chiediACommandV3,
  caricaConversazioneCommandV3,
  listConversazioniCommandV3,
  salvaConversazioneCommandV3,
  type V3CommandMessaggio,
  type V3ConversazioneRecente,
} from "@/data/v3/command";
import { costruisciGroundingCommandV3 } from "./kb";

export type { V3CommandMessaggio, V3ConversazioneRecente };

export interface UseCommandResult {
  readonly messaggi: readonly V3CommandMessaggio[];
  readonly bozza: string;
  readonly setBozza: (value: string) => void;
  readonly invia: () => void;
  readonly isPending: boolean;
  readonly errore: string | null;
  readonly conversazioni: readonly V3ConversazioneRecente[];
  readonly conversazioneAttiva: string | null;
  readonly apriConversazione: (id: string) => void;
  readonly nuovaConversazione: () => void;
  readonly pulisci: () => void;
}

export function useCommand(): UseCommandResult {
  const [messaggi, setMessaggi] = React.useState<readonly V3CommandMessaggio[]>([]);
  const [bozza, setBozza] = React.useState("");
  const [errore, setErrore] = React.useState<string | null>(null);
  const [conversazioneAttiva, setConversazioneAttiva] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const conversazioni = useQuery({
    queryKey: queryKeys.v3.commandConversazioni,
    queryFn: listConversazioniCommandV3,
    staleTime: 60_000,
  });

  /** Persiste lo scambio completo e memorizza l'id della conversazione. */
  const persisti = React.useCallback(
    async (turni: readonly V3CommandMessaggio[], id: string | null) => {
      try {
        const nuovoId = await salvaConversazioneCommandV3({ id, messaggi: turni });
        if (nuovoId && nuovoId !== id) setConversazioneAttiva(nuovoId);
        await queryClient.invalidateQueries({ queryKey: queryKeys.v3.commandConversazioni });
      } catch {
        // Il salvataggio è accessorio: un errore non deve rompere il dialogo.
      }
    },
    [queryClient],
  );

  const invio = useMutation({
    mutationFn: async (domanda: string) => {
      const storico = messaggi;
      return chiediACommandV3(storico, domanda, costruisciGroundingCommandV3());
    },

    onSuccess: (risposta, domanda) => {
      const turni: readonly V3CommandMessaggio[] = [
        ...messaggi,
        { ruolo: "user", contenuto: domanda },
        { ruolo: "assistant", contenuto: risposta },
      ];
      setMessaggi(turni);
      void persisti(turni, conversazioneAttiva);
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

  const apriConversazione = React.useCallback((id: string) => {
    setErrore(null);
    setConversazioneAttiva(id);
    void caricaConversazioneCommandV3(id)
      .then((turni) => setMessaggi(turni))
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : String(e)));
  }, []);

  const nuovaConversazione = React.useCallback(() => {
    setConversazioneAttiva(null);
    setMessaggi([]);
    setErrore(null);
  }, []);

  return {
    messaggi,
    bozza,
    setBozza,
    invia,
    isPending: invio.isPending,
    errore,
    conversazioni: conversazioni.data ?? [],
    conversazioneAttiva,
    apriConversazione,
    nuovaConversazione,
    pulisci: nuovaConversazione,
  };
}
