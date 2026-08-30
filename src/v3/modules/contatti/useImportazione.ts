/**
 * Stato della pagina "Import". Elenco storico import + rilancio elaborazione.
 */
import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listImportLogsV3, processaImportV3, type V3ImportLog } from "@/data/v3/importazione";

const PER_PAGINA = 25;

export const V3_STATI_IMPORT = ["pending", "processing", "completed", "failed"] as const;

export interface UseImportazioneResult {
  readonly righe: readonly V3ImportLog[];
  readonly totale: number;
  readonly pagina: number;
  readonly pagineTotali: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly stato: string | null;
  readonly setStato: (value: string | null) => void;
  readonly processa: (id: string) => void;
  readonly isProcessando: boolean;
  readonly erroreProcessazione: string | null;
  readonly vaiA: (pagina: number) => void;
  readonly refetch: () => void;
}

export function useImportazione(): UseImportazioneResult {
  const queryClient = useQueryClient();
  const [stato, setStatoState] = React.useState<string | null>(null);
  const [pagina, setPagina] = React.useState(0);
  const [erroreProcessazione, setErroreProcessazione] = React.useState<string | null>(null);

  const filtri = React.useMemo(() => ({ stato, pagina, perPagina: PER_PAGINA }), [stato, pagina]);

  const query = useQuery({
    queryKey: queryKeys.v3.importLogs(filtri),
    queryFn: () => listImportLogsV3(filtri),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const processamento = useMutation({
    mutationFn: (id: string) => processaImportV3(id),
    onSuccess: () => {
      setErroreProcessazione(null);
      void queryClient.invalidateQueries({ queryKey: ["v3", "import-logs"] });
    },
    onError: (err) => setErroreProcessazione(String(err)),
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
    stato,
    setStato: (value) => {
      setStatoState(value);
      setPagina(0);
    },
    processa: (id) => processamento.mutate(id),
    isProcessando: processamento.isPending,
    erroreProcessazione,
    vaiA: (value) => setPagina(Math.max(0, value)),
    refetch: () => void query.refetch(),
  };
}
