/**
 * Approvazioni — maschera Lista. "Cosa devo approvare prima che parta?"
 *
 * Lettura della coda `ai_pending_actions` + rifiuto. L'approvazione con invio
 * reale resta nella pipeline esistente finché il modulo di invio non è innestato.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useApprovazioni, V3_STATI_APPROVAZIONE } from "../useApprovazioni";

const ETICHETTA_STATO: Record<string, string> = {
  pending: "In attesa",
  approved: "Approvate",
  executed: "Eseguite",
  failed: "Fallite",
  rejected: "Rifiutate",
};

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function dataOra(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ApprovazioniPage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    sintesi,
    stato,
    setStato,
    tipoAzione,
    setTipoAzione,
    rischio,
    setRischio,
    selezionata,
    seleziona,
    rifiuta,
    isRifiutando,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useApprovazioni();

  const corrente = righe.find((r) => r.id === selezionata) ?? null;

  const filters = (
    <>
      <RailGroup label="Stato">
        <div className="flex flex-wrap gap-1">
          {V3_STATI_APPROVAZIONE.map((value) => (
            <Button
              key={value}
              variant={stato === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStato(value)}
            >
              {ETICHETTA_STATO[value] ?? value}
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Tipo di azione">
        <select
          value={tipoAzione ?? ""}
          onChange={(event) => setTipoAzione(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutti i tipi</option>
          {(sintesi?.perTipo ?? []).map((item) => (
            <option key={item.tipo} value={item.tipo}>
              {item.tipo} ({item.conteggio})
            </option>
          ))}
        </select>
      </RailGroup>

      <RailGroup label="Rischio">
        <select
          value={rischio ?? ""}
          onChange={(event) => setRischio(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutti i livelli</option>
          {(sintesi?.perRischio ?? [])
            .filter((item) => item.rischio !== "non dichiarato")
            .map((item) => (
              <option key={item.rischio} value={item.rischio}>
                {item.rischio} ({item.conteggio})
              </option>
            ))}
        </select>
      </RailGroup>

      <Button variant="ghost" size="sm" className="h-7 w-full px-2 text-xs" onClick={azzeraFiltri}>
        Azzera filtri
      </Button>
    </>
  );

  const workflow = (
    <>
      <RailGroup label="Azione selezionata">
        {corrente ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">{corrente.tipoAzione}</p>
            <p className="truncate text-xs text-muted-foreground">{corrente.indirizzo ?? "destinatario non indicato"}</p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              disabled={corrente.stato !== "pending" || isRifiutando}
              onClick={() => rifiuta(corrente.id)}
            >
              {isRifiutando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Rifiuta
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              L'approvazione con invio reale resta nella pipeline attuale: arriverà qui con il modulo di invio.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Seleziona una riga per vedere contenuto e motivazione.</p>
        )}
      </RailGroup>

      <RailGroup label="Coda">
        <p className="text-xs text-muted-foreground">{totale.toLocaleString("it-IT")} in stato «{ETICHETTA_STATO[stato] ?? stato}»</p>
        {sintesi && (
          <p className="text-xs text-muted-foreground">
            Campione sintesi: {sintesi.campione.toLocaleString("it-IT")}
          </p>
        )}
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={refetch}>
          <RefreshCw className="h-3.5 w-3.5" />
          Aggiorna
        </Button>
      </RailGroup>
    </>
  );

  const toolbar = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} azioni`}
      </span>
      {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <div className="ml-auto flex items-center gap-1">
        <span className="text-xs text-muted-foreground">
          Pagina {pagina + 1} di {pagineTotali}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Pagina precedente"
          disabled={pagina === 0}
          onClick={() => vaiA(pagina - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Pagina successiva"
          disabled={pagina + 1 >= pagineTotali}
          onClick={() => vaiA(pagina + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );

  return (
    <PageFrame pageId="approvazioni" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento coda…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare le approvazioni: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nessuna azione in questo stato.
        </div>
      ) : (
        <ul className="space-y-2">
          {righe.map((riga) => {
            const attiva = riga.id === selezionata;
            return (
              <li key={riga.id}>
                <button
                  type="button"
                  onClick={() => seleziona(attiva ? null : riga.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    attiva ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {riga.tipoAzione}
                    </Badge>
                    {riga.rischio && (
                      <Badge variant="secondary" className="text-[11px]">
                        {riga.rischio}
                      </Badge>
                    )}
                    {riga.origine && <span className="text-[11px] text-muted-foreground">{riga.origine}</span>}
                    <span className="ml-auto text-[11px] text-muted-foreground">{dataOra(riga.creatoIl)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {riga.indirizzo ?? "destinatario non indicato"}
                  </p>
                  <p className={`mt-1 text-xs text-muted-foreground ${attiva ? "" : "line-clamp-2"}`}>
                    {riga.contenuto ?? riga.motivazione ?? "Nessun contenuto suggerito."}
                  </p>
                  {attiva && riga.motivazione && (
                    <p className="mt-2 rounded bg-muted/60 p-2 text-xs text-muted-foreground">{riga.motivazione}</p>
                  )}
                  {attiva && riga.ultimoErrore && (
                    <p className="mt-2 text-xs text-destructive">Errore: {riga.ultimoErrore}</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}

export default ApprovazioniPage;
