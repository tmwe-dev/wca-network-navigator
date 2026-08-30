/**
 * Stato della scheda contatto: anagrafica + storia sintetica delle interazioni.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getContattoV3,
  listInterazioniContattoV3,
  type V3ContattoDettaglio,
  type V3Interazione,
} from "@/data/v3/contatti";

export interface UseContattoResult {
  readonly contatto: V3ContattoDettaglio | null;
  readonly interazioni: readonly V3Interazione[];
  readonly isLoading: boolean;
  readonly nonTrovato: boolean;
  readonly error: Error | null;
}

export function useContatto(id: string | undefined): UseContattoResult {
  const contatto = useQuery({
    queryKey: queryKeys.v3.contatto(id),
    queryFn: () => getContattoV3(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const interazioni = useQuery({
    queryKey: queryKeys.v3.contattoInterazioni(id),
    queryFn: () => listInterazioniContattoV3(id as string),
    enabled: Boolean(id) && Boolean(contatto.data),
    staleTime: 30_000,
  });

  return {
    contatto: contatto.data ?? null,
    interazioni: interazioni.data ?? [],
    isLoading: contatto.isLoading,
    nonTrovato: !contatto.isLoading && !contatto.error && contatto.data === null,
    error: (contatto.error as Error | null) ?? null,
  };
}
