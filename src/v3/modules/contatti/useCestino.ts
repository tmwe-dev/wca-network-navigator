/**
 * Stato della pagina "Cestino". Lettura via RPC dedicata; ripristino solo
 * per partner e contatti (i messaggi eliminati restano in sola lettura).
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  listCestinoV3,
  ripristinaV3,
  type V3ElementoEliminato,
  type V3TipoEliminato,
} from "@/data/v3/cestino";

const PERIODO_DEFAULT_GIORNI = 90;

export interface UseCestinoResult {
  readonly righe: readonly V3ElementoEliminato[];
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly tipo: V3TipoEliminato | null;
  readonly setTipo: (value: V3TipoEliminato | null) => void;
  readonly ripristina: (elemento: V3ElementoEliminato) => void;
  readonly isRipristinando: boolean;
  readonly erroreRipristino: string | null;
  readonly refetch: () => void;
}

export function useCestino(): UseCestinoResult {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = React.useState<V3TipoEliminato | null>(null);
  const [erroreRipristino, setErroreRipristino] = React.useState<string | null>(null);

  const filtri = React.useMemo(
    () => ({ tipo, giorni: PERIODO_DEFAULT_GIORNI, limite: 200 }),
    [tipo],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.cestino(filtri),
    queryFn: () => listCestinoV3(filtri),
    staleTime: 20_000,
  });

  const ripristino = useMutation({
    mutationFn: ({ tipo: t, id }: { tipo: "partner" | "contatto"; id: string }) => ripristinaV3(t, id),
    onSuccess: () => {
      setErroreRipristino(null);
      void queryClient.invalidateQueries({ queryKey: ["v3", "cestino"] });
    },
    onError: (err) => setErroreRipristino(String(err)),
  });

  return {
    righe: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    tipo,
    setTipo,
    ripristina: (elemento) => {
      if (elemento.tipo === "messaggio") return;
      ripristino.mutate({ tipo: elemento.tipo, id: elemento.id });
    },
    isRipristinando: ripristino.isPending,
    erroreRipristino,
    refetch: () => void query.refetch(),
  };
}
