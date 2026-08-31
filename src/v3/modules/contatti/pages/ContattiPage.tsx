/**
 * Contatti — maschera Lista di riferimento della V3.
 *
 * È l'esempio canonico dello standard descritto in docs/v3/standard-maschere.md:
 * intestazioni ordinabili, elementi cliccabili che aggiungono filtri, barra dei
 * filtri attivi con X sopra la tabella e nella sidebar, popup scheda azienda.
 */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Upload, UserPlus, Users } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Button } from "@/components/ui/button";
import { V3CellaFiltro, V3DataTable, type V3Colonna } from "@/v3/ui/DataTable";
import { V3FiltriAttivi } from "@/v3/ui/FiltriAttivi";
import { filtroAttivo, valoriDi } from "@/v3/ui/filtri";
import { CompanyLogo } from "@/v3/ui/CompanyLogo";
import { iso2Paese } from "@/v3/ui/paese";
import { CountryFlag } from "@/v3/ui/CountryFlag";
import { InterazioniBadge, StatoCircuitoBadge } from "@/v3/ui/StatoBadge";
import { RailAzione, RailScelte, RailSelect, RailSezione, RailToggle } from "@/v3/ui/Rail";
import { useContatti } from "../useContatti";
import { ETICHETTE_STATO_LEAD, V3_STATI_LEAD } from "../statiLead";
import { ETICHETTE_FONTE, V3_FONTI_ANAGRAFICA, type V3AnagraficaRiga } from "@/v3/modules/contatti/useContatti";
import { SchedaAzienda } from "./SchedaAzienda";

const CLASSI_FONTE: Record<string, string> = {
  crm: "border-primary/50 bg-primary/15 text-foreground",
  biglietti: "border-accent/60 bg-accent/20 text-foreground",
  wca: "border-border bg-muted/30 text-muted-foreground",
};

function Etichetta({ children, classe }: { children: React.ReactNode; classe?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] leading-none ${
        classe ?? "border-border bg-transparent text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

export function ContattiPage(): React.ReactElement {
  const navigate = useNavigate();
  const {
    righe,
    totale,
    pagina,
    perPagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    ricerca,
    setRicerca,
    filtri,
    alterna,
    rimuoviFiltro,
    soloConEmail,
    setSoloConEmail,
    paesiDisponibili,
    ordinamento,
    ordinaPer,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useContatti();

  const [azienda, setAzienda] = React.useState<{ nome: string; dominio: string | null } | null>(null);

  const fonteSelezionata = valoriDi(filtri, "fonte")[0] ?? null;
  const statoSelezionato = valoriDi(filtri, "stato")[0] ?? null;
  const paeseSelezionato = valoriDi(filtri, "paese")[0] ?? null;

  const alternaFonte = React.useCallback(
    (valore: string) =>
      alterna({ campo: "fonte", valore, etichetta: `Fonte: ${ETICHETTE_FONTE[valore as never] ?? valore}` }),
    [alterna],
  );
  const alternaStato = React.useCallback(
    (valore: string) =>
      alterna({ campo: "stato", valore, etichetta: `Stato: ${ETICHETTE_STATO_LEAD[valore] ?? valore}` }),
    [alterna],
  );
  const alternaPaese = React.useCallback(
    (valore: string, etichetta?: string) =>
      alterna({ campo: "paese", valore, etichetta: `Paese: ${etichetta ?? valore}` }),
    [alterna],
  );
  const alternaAzienda = React.useCallback(
    (nome: string) =>
      alterna({ campo: "azienda", valore: nome.trim().toLowerCase(), etichetta: `Azienda: ${nome}` }),
    [alterna],
  );

  const colonne = React.useMemo<readonly V3Colonna<V3AnagraficaRiga>[]>(
    () => [
      {
        id: "contatto",
        intestazione: "Contatto",
        larghezza: "w-[30%]",
        ordinaPer: "nome",
        cella: (riga) => (
          <div className="flex min-w-0 items-center gap-2 text-left">
            <CompanyLogo dominio={riga.dominio} nome={riga.azienda ?? riga.nome} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{riga.nome ?? "Senza nome"}</p>
              <p className="truncate text-xs text-muted-foreground">{riga.email ?? "nessuna email"}</p>
            </div>
          </div>
        ),
      },
      {
        id: "azienda",
        intestazione: "Azienda",
        larghezza: "w-[24%]",
        ordinaPer: "azienda",
        cella: (riga) => (
          <div className="min-w-0 text-left">
            {riga.azienda ? (
              <V3CellaFiltro
                onFiltra={() => alternaAzienda(riga.azienda as string)}
                attivo={filtroAttivo(filtri, "azienda", riga.azienda.trim().toLowerCase())}
                titolo={`Filtra per ${riga.azienda}`}
                className="block w-full px-1 -mx-1"
              >
                <span className="block truncate text-xs text-foreground">{riga.azienda}</span>
              </V3CellaFiltro>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
            {riga.colleghi > 1 && riga.azienda && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setAzienda({ nome: riga.azienda as string, dominio: riga.dominio });
                }}
                className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-accent/60 hover:text-foreground"
              >
                <Users className="h-3 w-3" />
                {riga.colleghi} persone
              </button>
            )}
          </div>
        ),
      },
      {
        id: "fonte",
        intestazione: "Fonte",
        larghezza: "w-24",
        ordinaPer: "fonte",
        cella: (riga) => (
          <V3CellaFiltro onFiltra={() => alternaFonte(riga.fonte)} attivo={filtroAttivo(filtri, "fonte", riga.fonte)}>
            <Etichetta classe={CLASSI_FONTE[riga.fonte]}>{ETICHETTE_FONTE[riga.fonte]}</Etichetta>
          </V3CellaFiltro>
        ),
      },
      {
        id: "paese",
        intestazione: "Paese",
        larghezza: "w-36",
        secondaria: true,
        ordinaPer: "paese",
        cella: (riga) => {
          const codice = riga.paeseCode ?? riga.paese;
          const nome = riga.paese ?? iso2Paese(codice) ?? null;
          if (!nome && !codice) return <span className="text-xs text-muted-foreground">—</span>;
          const valore = riga.paese ?? (codice as string);
          return (
            <V3CellaFiltro
              onFiltra={() => alternaPaese(valore, nome ?? valore)}
              attivo={filtroAttivo(filtri, "paese", valore)}
              className="block w-full px-1 -mx-1"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CountryFlag paese={codice} />
                <span className="truncate">{nome ?? valore}</span>
              </span>
            </V3CellaFiltro>
          );
        },
      },
      {
        // Stato del circuito (holding incluso) e interazioni sono sempre
        // visibili ed evidenziati: mai colonne secondarie.
        id: "stato",
        intestazione: "Stato circuito",
        larghezza: "w-32",
        ordinaPer: "stato",
        cella: (riga) =>
          riga.stato ? (
            <V3CellaFiltro
              onFiltra={() => alternaStato(riga.stato as string)}
              attivo={filtroAttivo(filtri, "stato", riga.stato)}
            >
              <StatoCircuitoBadge stato={riga.stato} />
            </V3CellaFiltro>
          ) : (
            <StatoCircuitoBadge stato={riga.stato} />
          ),
      },
      {
        id: "interazioni",
        intestazione: "Interazioni",
        larghezza: "w-24",
        ordinaPer: "interazioni",
        cella: (riga) => <InterazioniBadge numero={riga.interazioni} />,
      },
    ],
    [filtri, alternaAzienda, alternaFonte, alternaPaese, alternaStato],
  );

  const filters = (
    <>
      <RailSezione titolo="Ricerca">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={ricerca}
            onChange={(event) => setRicerca(event.target.value)}
            placeholder="Nome, azienda, email"
            className="h-8 w-full bg-transparent text-left text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </RailSezione>

      {filtri.length > 0 && (
        <RailSezione titolo={`Filtri attivi (${filtri.length})`}>
          <V3FiltriAttivi filtri={filtri} onRimuovi={rimuoviFiltro} onAzzera={azzeraFiltri} compatto />
        </RailSezione>
      )}

      <RailSezione titolo="Provenienza">
        <RailScelte
          valore={fonteSelezionata}
          onChange={(valore) => (valore ? alternaFonte(valore) : azzeraCampo("fonte"))}
          opzioni={[
            { valore: null, etichetta: "Tutte" },
            ...V3_FONTI_ANAGRAFICA.map((value) => ({ valore: value, etichetta: ETICHETTE_FONTE[value] })),
          ]}
        />
      </RailSezione>

      <RailSezione titolo="Stato">
        <RailScelte
          valore={statoSelezionato}
          onChange={(valore) => (valore ? alternaStato(valore) : azzeraCampo("stato"))}
          opzioni={[
            { valore: null, etichetta: "Tutti" },
            ...V3_STATI_LEAD.map((value) => ({ valore: value, etichetta: ETICHETTE_STATO_LEAD[value] ?? value })),
          ]}
        />
      </RailSezione>

      <RailSezione titolo="Paese" apertaDefault={false}>
        <RailSelect
          valore={paeseSelezionato}
          onChange={(valore) => (valore ? alternaPaese(valore) : azzeraCampo("paese"))}
          etichettaVuoto="Tutti i paesi"
          opzioni={paesiDisponibili.map((code) => ({ valore: code, etichetta: code }))}
        />
      </RailSezione>

      <RailSezione titolo="Contattabilità" apertaDefault={false}>
        <RailToggle etichetta="Solo con email" attivo={soloConEmail} onChange={setSoloConEmail} />
        <RailAzione onClick={azzeraFiltri}>Azzera filtri</RailAzione>
      </RailSezione>
    </>
  );

  function azzeraCampo(campo: string): void {
    filtri.filter((f) => f.campo === campo).forEach(rimuoviFiltro);
  }

  const workflow = (
    <>
      <RailSezione titolo="Aggiungi">
        <RailAzione disabilitato icona={<UserPlus className="h-3.5 w-3.5" />}>
          Nuovo contatto
        </RailAzione>
        <RailAzione disabilitato icona={<Upload className="h-3.5 w-3.5" />}>
          Import
        </RailAzione>
      </RailSezione>

      <RailSezione titolo="Stato dati">
        <p className="text-left text-xs text-muted-foreground">{totale.toLocaleString("it-IT")} voci nel filtro</p>
        <RailAzione onClick={refetch} icona={<RefreshCw className="h-3.5 w-3.5" />}>
          Aggiorna
        </RailAzione>
      </RailSezione>
    </>
  );

  const toolbar = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} voci`}
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
    <PageFrame pageId="contatti" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center gap-2 text-left text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento anagrafica…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-left text-sm text-destructive">
          Impossibile caricare l'anagrafica: {error.message}
        </div>
      ) : (
        <>
          {filtri.length > 0 && (
            <div className="mb-2">
              <V3FiltriAttivi filtri={filtri} onRimuovi={rimuoviFiltro} onAzzera={azzeraFiltri} />
            </div>
          )}

          <V3DataTable
            colonne={colonne}
            righe={righe}
            chiave={(riga) => `${riga.fonte}-${riga.id}`}
            ordinamento={ordinamento}
            onOrdina={ordinaPer}
            vuoto="Nessuna voce corrisponde ai filtri."
            onRigaClick={(riga) => {
              // Solo i contatti CRM hanno una scheda dettaglio in V3.
              if (riga.fonte === "crm") navigate(`/v3/contatti/${riga.id}`);
            }}
          />
          {righe.length > 0 && (
            <p className="mt-2 text-left text-[11px] text-muted-foreground">
              Righe {pagina * perPagina + 1}–{pagina * perPagina + righe.length} di{" "}
              {totale.toLocaleString("it-IT")}.{" "}
              <Link to="/v3/duplicati" className="underline underline-offset-2 hover:text-foreground">
                Verifica duplicati
              </Link>
            </p>
          )}
        </>
      )}

      {azienda && (
        <SchedaAzienda
          azienda={azienda.nome}
          dominio={azienda.dominio}
          onChiudi={() => setAzienda(null)}
          onFiltraAzienda={(chiave) =>
            alterna({ campo: "azienda", valore: chiave, etichetta: `Azienda: ${azienda.nome}` })
          }
          onApriContatto={(id) => {
            setAzienda(null);
            navigate(`/v3/contatti/${id}`);
          }}
        />
      )}
    </PageFrame>
  );
}

export default ContattiPage;
