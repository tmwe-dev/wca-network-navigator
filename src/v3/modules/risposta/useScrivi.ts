/**
 * Stato della pagina "Scrivi". La pagina compone una bozza e la mette in coda
 * di approvazione: nessun invio diretto, l'editorial review è obbligatoria.
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  accodaBozzaV3,
  cercaDestinatariV3,
  generaBozzaV3,
  type V3Bozza,
  type V3Destinatario,
} from "@/data/v3/scrivi";
import { listModelliV3, type V3Modello } from "@/data/v3/risposta";

export type { V3Destinatario } from "@/data/v3/scrivi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UseScriviResult {
  readonly destinatario: V3Destinatario | null;
  readonly emailLibera: string;
  readonly setEmailLibera: (value: string) => void;
  readonly ricerca: string;
  readonly setRicerca: (value: string) => void;
  readonly risultati: readonly V3Destinatario[];
  readonly isCercando: boolean;
  readonly seleziona: (destinatario: V3Destinatario | null) => void;

  readonly oggetto: string;
  readonly setOggetto: (value: string) => void;
  readonly corpo: string;
  readonly setCorpo: (value: string) => void;

  readonly obiettivo: string;
  readonly setObiettivo: (value: string) => void;
  readonly genera: () => void;
  readonly isGenerando: boolean;
  readonly revisione: V3Bozza["revisione"];
  readonly erroreGenerazione: string | null;

  readonly modelli: readonly V3Modello[];
  readonly applicaModello: (modello: V3Modello) => void;

  readonly emailEffettiva: string;
  readonly pronto: boolean;
  readonly accoda: () => void;
  readonly isAccodando: boolean;
  readonly esitoAccodamento: string | null;
  readonly azzera: () => void;
}

export function useScrivi(): UseScriviResult {
  const queryClient = useQueryClient();
  const [destinatario, setDestinatario] = React.useState<V3Destinatario | null>(null);
  const [emailLibera, setEmailLibera] = React.useState("");
  const [ricerca, setRicercaState] = React.useState("");
  const [ricercaDebounced, setRicercaDebounced] = React.useState("");
  const [oggetto, setOggetto] = React.useState("");
  const [corpo, setCorpo] = React.useState("");
  const [esitoAccodamento, setEsitoAccodamento] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setRicercaDebounced(ricerca), 300);
    return () => clearTimeout(timer);
  }, [ricerca]);

  const ricercaQuery = useQuery({
    queryKey: queryKeys.v3.scriviDestinatari(ricercaDebounced),
    queryFn: () => cercaDestinatariV3(ricercaDebounced),
    enabled: ricercaDebounced.trim().length >= 2 && !destinatario,
    staleTime: 30_000,
  });

  const modelliQuery = useQuery({
    queryKey: queryKeys.v3.modelli({ attivo: true }),
    queryFn: () => listModelliV3({ attivo: true, pagina: 0, perPagina: 50 }),
    staleTime: 60_000,
  });

  const [obiettivo, setObiettivo] = React.useState("");
  const [revisione, setRevisione] = React.useState<V3Bozza["revisione"]>(null);
  const [erroreGenerazione, setErroreGenerazione] = React.useState<string | null>(null);

  const generazione = useMutation({
    mutationFn: generaBozzaV3,
    onSuccess: (bozza) => {
      if (bozza.oggetto) setOggetto(bozza.oggetto);
      if (bozza.corpo) setCorpo(bozza.corpo);
      setRevisione(bozza.revisione);
    },
    onError: (err: unknown) => {
      setErroreGenerazione(err instanceof Error ? err.message : "Generazione non riuscita.");
    },
  });

  const accodamento = useMutation({
    mutationFn: accodaBozzaV3,
    onSuccess: () => {
      setEsitoAccodamento("Bozza in coda: la trovi in Approvazioni.");
      setDestinatario(null);
      setEmailLibera("");
      setRicercaState("");
      setOggetto("");
      setCorpo("");
      setRevisione(null);
      void queryClient.invalidateQueries({ queryKey: ["v3", "approvazioni"] });
    },
  });

  const emailEffettiva = (destinatario?.email ?? emailLibera).trim();
  const pronto =
    EMAIL_RE.test(emailEffettiva) && oggetto.trim().length >= 3 && corpo.trim().length >= 5;

  return {
    destinatario,
    emailLibera,
    setEmailLibera,
    ricerca,
    setRicerca: (value) => {
      setRicercaState(value);
      setEsitoAccodamento(null);
    },
    risultati: ricercaQuery.data ?? [],
    isCercando: ricercaQuery.isFetching,
    seleziona: (value) => {
      setDestinatario(value);
      if (value) setRicercaState("");
    },
    oggetto,
    setOggetto,
    corpo,
    setCorpo,
    obiettivo,
    setObiettivo,
    genera: () => {
      setErroreGenerazione(null);
      setRevisione(null);
      generazione.mutate({
        obiettivo: obiettivo.trim() || "Primo contatto commerciale, tono professionale e sintetico.",
        nome: destinatario?.nome ?? null,
        azienda: destinatario?.azienda ?? null,
        partnerId: destinatario?.partnerId ?? null,
        contattoId: destinatario?.contattoId ?? null,
      });
    },
    isGenerando: generazione.isPending,
    revisione,
    erroreGenerazione,

    modelli: modelliQuery.data?.righe ?? [],
    applicaModello: (modello) => {
      const parti = [modello.obiettivo, modello.procedura].filter(Boolean).join("\n\n");
      if (parti) setCorpo(parti);
    },
    emailEffettiva,
    pronto,
    accoda: () => {
      setEsitoAccodamento(null);
      accodamento.mutate({
        to: emailEffettiva,
        subject: oggetto.trim(),
        body: corpo.trim(),
        partnerId: destinatario?.partnerId ?? null,
        contattoId: destinatario?.contattoId ?? null,
      });
    },
    isAccodando: accodamento.isPending,
    esitoAccodamento,
    azzera: () => {
      setDestinatario(null);
      setEmailLibera("");
      setRicercaState("");
      setOggetto("");
      setCorpo("");
      setEsitoAccodamento(null);
      setObiettivo("");
      setRevisione(null);
      setErroreGenerazione(null);
    },
  };
}
