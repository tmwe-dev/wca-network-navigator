/**
 * Stato della conversazione: messaggio aperto + resto del thread.
 * Marca il messaggio come letto una sola volta per apertura.
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getMessaggioV3,
  listThreadV3,
  segnaLettoV3,
  type V3MessaggioDettaglio,
  type V3MessaggioRiga,
} from "@/data/v3/messaggi";

export interface UseConversazioneResult {
  readonly messaggio: V3MessaggioDettaglio | null;
  readonly thread: readonly V3MessaggioRiga[];
  readonly isLoading: boolean;
  readonly nonTrovato: boolean;
  readonly error: Error | null;
}

export function useConversazione(id: string | undefined): UseConversazioneResult {
  const queryClient = useQueryClient();

  const messaggio = useQuery({
    queryKey: queryKeys.v3.messaggio(id),
    queryFn: () => getMessaggioV3(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const threadId = messaggio.data?.threadId ?? null;

  const thread = useQuery({
    queryKey: queryKeys.v3.messaggioThread(threadId),
    queryFn: () => listThreadV3(threadId as string, id),
    enabled: Boolean(threadId) && Boolean(id),
    staleTime: 30_000,
  });

  const marcaLetto = useMutation({
    mutationFn: (messageId: string) => segnaLettoV3(messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["v3", "messaggi"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.v3.messaggio(id) });
    },
  });

  // Una sola marcatura per messaggio aperto: niente scritture ripetute a ogni render.
  const marcatoRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const data = messaggio.data;
    if (!data || data.letto || marcatoRef.current === data.id) return;
    marcatoRef.current = data.id;
    marcaLetto.mutate(data.id);
  }, [messaggio.data, marcaLetto]);

  return {
    messaggio: messaggio.data ?? null,
    thread: thread.data ?? [],
    isLoading: messaggio.isLoading,
    nonTrovato: !messaggio.isLoading && !messaggio.error && messaggio.data === null,
    error: (messaggio.error as Error | null) ?? null,
  };
}
