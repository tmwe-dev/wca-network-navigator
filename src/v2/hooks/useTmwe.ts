/**
 * useTmwe — React Query hooks per integrazione TMWE/Findair.
 * Wrappa la DAL in `src/data/tmwe.ts`. Logica solo qui (non in UI).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  tmweQueryKeys,
  findTmweCandidates,
  linkPartnerToTmwe,
  unlinkPartnerFromTmwe,
  getTmwePartnerLink,
  getTmweSnapshot,
  getRevenueLast12Months,
  listTmweCustomers,
  triggerCustomerResync,
  lookupTmweQuote,
  type TmweCandidate,
  type TmwePartnerLink,
  type TmweCustomerSnapshot,
  type TmweRevenueRow,
  type TmweQuoteResult,
} from "@/data/tmwe";

/** Link partner → TMWE customer (read). */
export function useTmwePartnerLink(partnerId: string | null | undefined) {
  return useQuery<TmwePartnerLink | null>({
    queryKey: tmweQueryKeys.partnerLink(partnerId ?? ""),
    queryFn: () => getTmwePartnerLink(partnerId as string),
    enabled: Boolean(partnerId),
    staleTime: 60_000,
  });
}

/** Candidati di matching VAT/VIES/nome (on-demand). */
export function useTmweMatchCandidates(partnerId: string | null | undefined, enabled = false) {
  return useQuery<{ candidates: TmweCandidate[]; partner: { vat: string | null; denomination: string; city: string } }>({
    queryKey: tmweQueryKeys.matchCandidates(partnerId ?? ""),
    queryFn: () => findTmweCandidates(partnerId as string),
    enabled: Boolean(partnerId) && enabled,
    staleTime: 30_000,
  });
}

/** Snapshot anagrafica TMWE per cliente collegato. */
export function useTmweSnapshot(clientId: string | null | undefined) {
  return useQuery<TmweCustomerSnapshot | null>({
    queryKey: tmweQueryKeys.snapshot(clientId ?? ""),
    queryFn: () => getTmweSnapshot(clientId as string),
    enabled: Boolean(clientId),
    staleTime: 5 * 60_000,
  });
}

/** Fatturato ultimi 12 mesi. */
export function useTmweRevenue(clientId: string | null | undefined) {
  return useQuery<TmweRevenueRow[]>({
    queryKey: tmweQueryKeys.revenue(clientId ?? ""),
    queryFn: () => getRevenueLast12Months(clientId as string),
    enabled: Boolean(clientId),
    staleTime: 5 * 60_000,
  });
}

/** Lista clienti TMWE sincronizzati (per /v2/tmwe/clients). */
export function useTmweCustomers() {
  return useQuery({
    queryKey: tmweQueryKeys.customersList(),
    queryFn: listTmweCustomers,
    staleTime: 60_000,
  });
}

/** Mutazione: collega partner → TMWE client. */
export function useLinkPartnerTmwe(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: linkPartnerToTmwe,
    onSuccess: (link) => {
      toast.success("Partner collegato a TMWE");
      qc.invalidateQueries({ queryKey: tmweQueryKeys.partnerLink(partnerId) });
      qc.invalidateQueries({ queryKey: tmweQueryKeys.snapshot(link.tmwe_client_id) });
      qc.invalidateQueries({ queryKey: tmweQueryKeys.revenue(link.tmwe_client_id) });
      qc.invalidateQueries({ queryKey: tmweQueryKeys.customersList() });
    },
    onError: (e: Error) => toast.error(`Errore link TMWE: ${e.message}`),
  });
}

/** Mutazione: scollega partner. */
export function useUnlinkPartnerTmwe(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unlinkPartnerFromTmwe(partnerId),
    onSuccess: () => {
      toast.success("Collegamento TMWE rimosso");
      qc.invalidateQueries({ queryKey: tmweQueryKeys.partnerLink(partnerId) });
      qc.invalidateQueries({ queryKey: tmweQueryKeys.customersList() });
    },
    onError: (e: Error) => toast.error(`Errore unlink: ${e.message}`),
  });
}

/** Mutazione: forza resync di un singolo cliente TMWE. */
export function useResyncTmweCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => triggerCustomerResync(clientId),
    onSuccess: (_, clientId) => {
      toast.success("Sync TMWE avviato");
      qc.invalidateQueries({ queryKey: tmweQueryKeys.snapshot(clientId) });
      qc.invalidateQueries({ queryKey: tmweQueryKeys.revenue(clientId) });
      qc.invalidateQueries({ queryKey: tmweQueryKeys.customersList() });
    },
    onError: (e: Error) => toast.error(`Sync fallito: ${e.message}`),
  });
}

/** Mutazione: rate lookup per quotazione. */
export function useTmweQuote() {
  return useMutation<TmweQuoteResult, Error, Parameters<typeof lookupTmweQuote>[0]>({
    mutationFn: lookupTmweQuote,
    onError: (e) => toast.error(`Quotazione fallita: ${e.message}`),
  });
}