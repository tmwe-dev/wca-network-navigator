/**
 * Modelli — maschera Lista. "Con che tono e struttura scriviamo?"
 * Legge i prompt operativi (contesto, obiettivo, procedura, criteri, esempi).
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useModelli } from "../useModelli";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Sezione({ titolo, testo }: { titolo: string; testo: string | null }) {
  if (!testo) return null;
  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titolo}</p>
      <p className="whitespace-pre-wrap text-xs text-foreground/80">{testo}</p>
    </div>
  );
}

export function ModelliPage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    tagDisponibili,
    ricerca,
    setRicerca,
    tag,
    setTag,
    attivo,
    setAttivo,
    selezionato,
    seleziona,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useModelli();

  const filters = (
    <>
      <RailGroup label="Ricerca">
        <Input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Nome, obiettivo, contesto"
          className="h-8 text-xs"
        />
      </RailGroup>

      <RailGroup label="Uso">
        <select
          value={tag ?? ""}
          onChange={(event) => setTag(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutti i tag</option>
          {tagDisponibili.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </RailGroup>

      <RailGroup label="Stato">
        <div className="flex flex-wrap gap-1">
          {[
            { label: "Attivi", value: true as boolean | null },
            { label: "Disattivi", value: false as boolean | null },
            { label: "Tutti", value: null as boolean | null },
          ].map((item) => (
            <Button
              key={String(item.label)}
              variant={attivo === item.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setAttivo(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
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
          Nuovo modello
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          Duplica
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Modifica e prova dei modelli arrivano con la maschera «Scrivi»: qui la lettura è già quella reale.
        </p>
      </RailGroup>

      <RailGroup label="Catalogo">
        <p className="text-xs text-muted-foreground">{totale.toLocaleString("it-IT")} modelli</p>
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
        <FileText className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} modelli`}
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
    <PageFrame pageId="modelli" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento modelli…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare i modelli: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nessun modello con questi filtri.
        </div>
      ) : (
        <ul className="space-y-2">
          {righe.map((riga) => {
            const aperto = riga.id === selezionato;
            return (
              <li key={riga.id}>
                <button
                  type="button"
                  onClick={() => seleziona(aperto ? null : riga.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    aperto ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{riga.nome}</span>
                    {!riga.attivo && (
                      <Badge variant="outline" className="text-[11px]">
                        disattivo
                      </Badge>
                    )}
                    {riga.tag.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[11px]">
                        {t}
                      </Badge>
                    ))}
                    <span className="ml-auto text-[11px] text-muted-foreground">priorità {riga.priorita ?? 0}</span>
                  </div>
                  <p className={`mt-1 text-xs text-muted-foreground ${aperto ? "" : "line-clamp-2"}`}>
                    {riga.obiettivo ?? riga.contesto ?? "Nessun obiettivo dichiarato."}
                  </p>
                  {aperto && (
                    <div className="mt-2 border-t border-border pt-2">
                      <Sezione titolo="Contesto" testo={riga.contesto} />
                      <Sezione titolo="Procedura" testo={riga.procedura} />
                      <Sezione titolo="Criteri" testo={riga.criteri} />
                      <Sezione titolo="Esempi" testo={riga.esempi} />
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

export default ModelliPage;
