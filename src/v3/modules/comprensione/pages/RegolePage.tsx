/**
 * Regole e gruppi — maschera Lista. "Come viene smistato ciò che arriva?"
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, Filter, Loader2, Plus, RefreshCw, Wand2 } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegole } from "../useRegole";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function dataBreve(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "2-digit" });
}

export function RegolePage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    perPagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    gruppi,
    ricerca,
    setRicerca,
    gruppoId,
    setGruppoId,
    attiva,
    setAttiva,
    soloBloccati,
    setSoloBloccati,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useRegole();

  const filters = (
    <>
      <RailGroup label="Ricerca">
        <Input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Indirizzo, dominio, azienda"
          className="h-8 text-xs"
        />
      </RailGroup>

      <RailGroup label="Gruppo">
        <select
          value={gruppoId ?? ""}
          onChange={(event) => setGruppoId(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutti i gruppi</option>
          {gruppi.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome} ({item.regole})
            </option>
          ))}
        </select>
      </RailGroup>

      <RailGroup label="Stato">
        <div className="flex flex-wrap gap-1">
          <Button
            variant={attiva === true ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setAttiva(true)}
          >
            Attive
          </Button>
          <Button
            variant={attiva === false ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setAttiva(false)}
          >
            Disattivate
          </Button>
          <Button
            variant={attiva === null ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setAttiva(null)}
          >
            Tutte
          </Button>
        </div>
        <Button
          variant={soloBloccati ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs"
          onClick={() => setSoloBloccati(!soloBloccati)}
        >
          Solo mittenti bloccati
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
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          <Plus className="h-3.5 w-3.5" />
          Nuova regola
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          <Wand2 className="h-3.5 w-3.5" />
          Testa smistamento
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Creazione e correzione delle regole arrivano subito dopo: qui si legge come sta smistando oggi.
        </p>
      </RailGroup>

      <RailGroup label="Gruppi">
        <div className="space-y-1">
          {gruppi.slice(0, 10).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setGruppoId(gruppoId === item.id ? null : item.id)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-muted/60"
            >
              <span className="truncate text-foreground/90">{item.nome}</span>
              <span className="ml-2 shrink-0 text-muted-foreground">{item.regole}</span>
            </button>
          ))}
          {gruppi.length === 0 && <p className="text-xs text-muted-foreground">Nessun gruppo definito.</p>}
        </div>
      </RailGroup>

      <RailGroup label="Stato dati">
        <p className="text-xs text-muted-foreground">{totale.toLocaleString("it-IT")} regole nel filtro</p>
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
        <Filter className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} regole`}
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
    <PageFrame pageId="regole" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento regole…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare le regole: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nessuna regola corrisponde ai filtri.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {righe.map((riga) => (
            <li key={riga.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {riga.indirizzo ?? riga.dominio ?? "(regola senza mittente)"}
                  </p>
                  {riga.gruppoNome && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {riga.gruppoNome}
                    </Badge>
                  )}
                  {riga.categoria && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {riga.categoria}
                    </Badge>
                  )}
                  {!riga.attiva && (
                    <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                      disattivata
                    </Badge>
                  )}
                  {riga.bloccato && (
                    <Badge variant="destructive" className="shrink-0 text-[10px]">
                      bloccato
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[riga.nomeVisualizzato, riga.azienda, riga.dominio].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {riga.azioneAutomatica
                    ? `Azione: ${riga.azioneAutomatica}${riga.eseguiAutomaticamente ? " (automatica)" : " (con approvazione)"}`
                    : "Nessuna azione automatica"}
                </p>
              </div>
              <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                <p>{riga.applicazioni.toLocaleString("it-IT")} applicazioni</p>
                <p>{riga.emailConteggio.toLocaleString("it-IT")} email</p>
                <p>ultima: {dataBreve(riga.ultimaApplicazione)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && righe.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Righe {pagina * perPagina + 1}–{pagina * perPagina + righe.length} di {totale.toLocaleString("it-IT")}.
        </p>
      )}
    </PageFrame>
  );
}

export default RegolePage;
