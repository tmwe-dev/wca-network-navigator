/**
 * Stato e logica della pagina Operatori. La UI resta senza logica.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listOperatoriV3, type V3Operatore } from "@/data/v3/identita";

export type FiltroStato = "tutti" | "attivi" | "sospesi";
export type FiltroRuolo = "tutti" | "admin" | "operatore";

export interface UseOperatoriResult {
  readonly operatori: readonly V3Operatore[];
  readonly totale: number;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly stato: FiltroStato;
  readonly setStato: (value: FiltroStato) => void;
  readonly ruolo: FiltroRuolo;
  readonly setRuolo: (value: FiltroRuolo) => void;
  readonly refetch: () => void;
}

export function useOperatori(): UseOperatoriResult {
  const [ricerca, setRicerca] = React.useState("");
  const [stato, setStato] = React.useState<FiltroStato>("tutti");
  const [ruolo, setRuolo] = React.useState<FiltroRuolo>("tutti");

  const query = useQuery({
    queryKey: queryKeys.v3.operatori,
    queryFn: listOperatoriV3,
    staleTime: 60_000,
  });

  const tutti = React.useMemo(() => query.data ?? [], [query.data]);

  const operatori = React.useMemo(() => {
    const needle = ricerca.trim().toLowerCase();
    return tutti.filter((row) => {
      if (needle && !`${row.email} ${row.nome ?? ""}`.toLowerCase().includes(needle)) return false;
      if (stato === "attivi" && !row.attivo) return false;
      if (stato === "sospesi" && row.attivo) return false;
      if (ruolo === "admin" && !row.admin) return false;
      if (ruolo === "operatore" && row.admin) return false;
      return true;
    });
  }, [tutti, ricerca, stato, ruolo]);

  return {
    operatori,
    totale: tutti.length,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    ricerca,
    setRicerca,
    stato,
    setStato,
    ruolo,
    setRuolo,
    refetch: () => void query.refetch(),
  };
}
