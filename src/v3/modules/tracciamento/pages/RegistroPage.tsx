/**
 * Registro AI — maschera Lista. "Cosa ha deciso l'AI e perché?"
 * Legge `ai_decision_log`. Sola lettura.
 */
import * as React from "react";
import { BrainCircuit, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useRegistro, V3_PERIODI_REGISTRO } from "../useRegistro";

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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function RegistroPage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    tipiDisponibili,
    giorni,
    setGiorni,
    tipoDecisione,
    setTipoDecisione,
    revisione,
    setRevisione,
    soloAutomatiche,
    setSoloAutomatiche,
    aperta,
    apri,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useRegistro();

  const filters = (
    <>
      <RailGroup label="Periodo">
        <div className="flex flex-wrap gap-1">
          {V3_PERIODI_REGISTRO.map((value) => (
            <Button
              key={value}
              variant={giorni === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setGiorni(value)}
            >
              {value} giorni
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Funzione">
        <select
          value={tipoDecisione ?? ""}
          onChange={(event) => setTipoDecisione(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutte le decisioni</option>
          {tipiDisponibili.map((item) => (
            <option key={item.tipo} value={item.tipo}>
              {item.tipo} ({item.conteggio})
            </option>
          ))}
        </select>
      </RailGroup>

      <RailGroup label="Esito">
        <div className="flex flex-wrap gap-1">
          {[
            { label: "Tutti", value: null as string | null },
            { label: "Approvate", value: "approved" as string | null },
            { label: "Rifiutate", value: "rejected" as string | null },
          ].map((item) => (
            <Button
              key={item.label}
              variant={revisione === item.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setRevisione(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Button
          variant={soloAutomatiche ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs"
          onClick={() => setSoloAutomatiche(!soloAutomatiche)}
        >
          Solo eseguite in autonomia
        </Button>
      </RailGroup>

      <Button variant="ghost" size="sm" className="h-7 w-full px-2 text-xs" onClick={azzeraFiltri}>
        Azzera filtri
      </Button>
    </>
  );

  const workflow = (
    <>
      <RailGroup label="Azioni">
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Esporta
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Clicca una riga per aprire ragionamento ed esito completi.
        </p>
      </RailGroup>

      <RailGroup label="Registro">
        <p className="text-xs text-muted-foreground">{totale.toLocaleString("it-IT")} decisioni nel periodo</p>
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
        <BrainCircuit className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} decisioni`}
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
    <PageFrame pageId="registro" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento registro…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare il registro: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nessuna decisione registrata con questi filtri.
        </div>
      ) : (
        <ul className="space-y-2">
          {righe.map((riga) => {
            const attiva = riga.id === aperta;
            return (
              <li key={riga.id}>
                <button
                  type="button"
                  onClick={() => apri(attiva ? null : riga.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    attiva ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {riga.tipoDecisione}
                    </Badge>
                    {riga.automatica && (
                      <Badge variant="secondary" className="text-[11px]">
                        autonoma
                      </Badge>
                    )}
                    {riga.revisione && (
                      <Badge variant={riga.revisione === "rejected" ? "destructive" : "secondary"} className="text-[11px]">
                        {riga.revisione === "rejected" ? "rifiutata" : "approvata"}
                      </Badge>
                    )}
                    {riga.confidenza !== null && (
                      <span className="text-[11px] text-muted-foreground">
                        confidenza {Math.round(riga.confidenza * 100)}%
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">{dataOra(riga.data)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {riga.indirizzo ?? "nessun destinatario"}
                  </p>
                  <p className={`mt-0.5 text-xs text-muted-foreground ${attiva ? "" : "line-clamp-2"}`}>
                    {riga.ragionamento ?? "Nessun ragionamento registrato."}
                  </p>
                  {attiva && (
                    <div className="mt-2 space-y-1 border-t border-border pt-2">
                      {riga.esito && (
                        <p className="whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px] text-muted-foreground">
                          {riga.esito}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {riga.modello ?? "modello non dichiarato"}
                        {riga.token !== null ? ` · ${riga.token.toLocaleString("it-IT")} token` : ""}
                        {riga.durataMs !== null ? ` · ${riga.durataMs} ms` : ""}
                      </p>
                    </div>
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

export default RegistroPage;
