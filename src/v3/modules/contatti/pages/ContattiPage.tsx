/**
 * Contatti — maschera Lista. "Chi devo contattare?"
 *
 * Anagrafica unificata (CRM, biglietti da visita, partner WCA) montata sullo
 * standard visivo V3: tabella unica (`V3DataTable`), sidebar a primitive
 * (`Rail*`), logo azienda, bandiera paese, indicatore di aziende con più
 * persone collegate. Nessuna logica qui: solo presentazione.
 */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Upload, UserPlus, Users } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Button } from "@/components/ui/button";
import { V3DataTable, type V3Colonna } from "@/v3/ui/DataTable";
import { CompanyLogo } from "@/v3/ui/CompanyLogo";
import { iso2Paese } from "@/v3/ui/paese";
import { CountryFlag } from "@/v3/ui/CountryFlag";
import { RailAzione, RailScelte, RailSelect, RailSezione, RailToggle } from "@/v3/ui/Rail";
import { useContatti } from "../useContatti";
import { ETICHETTE_STATO_LEAD, V3_STATI_LEAD, etichettaStato } from "../statiLead";
import { ETICHETTE_FONTE, V3_FONTI_ANAGRAFICA, type V3AnagraficaRiga } from "@/data/v3/anagrafiche";

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
    fonte,
    setFonte,
    paese,
    setPaese,
    stato,
    setStato,
    soloConEmail,
    setSoloConEmail,
    paesiDisponibili,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useContatti();

  const colonne = React.useMemo<readonly V3Colonna<V3AnagraficaRiga>[]>(
    () => [
      {
        id: "contatto",
        intestazione: "Contatto",
        larghezza: "w-[30%]",
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
        cella: (riga) => (
          <div className="min-w-0 text-left">
            <p className="truncate text-xs text-foreground">{riga.azienda ?? "—"}</p>
            {riga.colleghi > 1 && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" />
                {riga.colleghi} persone
              </span>
            )}
          </div>
        ),
      },
      {
        id: "fonte",
        intestazione: "Fonte",
        larghezza: "w-24",
        cella: (riga) => <Etichetta classe={CLASSI_FONTE[riga.fonte]}>{ETICHETTE_FONTE[riga.fonte]}</Etichetta>,
      },
      {
        id: "paese",
        intestazione: "Paese",
        larghezza: "w-36",
        secondaria: true,
        cella: (riga) => {
          const valore = riga.paeseCode ?? riga.paese;
          return (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CountryFlag paese={valore} />
              <span className="truncate">{riga.paese ?? iso2Paese(valore) ?? "—"}</span>
            </span>
          );
        },
      },
      {
        id: "stato",
        intestazione: "Stato",
        larghezza: "w-32",
        secondaria: true,
        cella: (riga) => <Etichetta>{etichettaStato(riga.stato)}</Etichetta>,
      },
      {
        id: "interazioni",
        intestazione: "Interazioni",
        larghezza: "w-24",
        secondaria: true,
        cella: (riga) => <span className="text-xs tabular-nums text-muted-foreground">{riga.interazioni}</span>,
      },
    ],
    [],
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

      <RailSezione titolo="Provenienza">
        <RailScelte
          valore={fonte}
          onChange={(valore) => setFonte(valore as typeof fonte)}
          opzioni={[
            { valore: null, etichetta: "Tutte" },
            ...V3_FONTI_ANAGRAFICA.map((value) => ({ valore: value, etichetta: ETICHETTE_FONTE[value] })),
          ]}
        />
      </RailSezione>

      <RailSezione titolo="Stato">
        <RailScelte
          valore={stato}
          onChange={setStato}
          opzioni={[
            { valore: null, etichetta: "Tutti" },
            ...V3_STATI_LEAD.map((value) => ({ valore: value, etichetta: ETICHETTE_STATO_LEAD[value] ?? value })),
          ]}
        />
      </RailSezione>

      <RailSezione titolo="Paese" apertaDefault={false}>
        <RailSelect
          valore={paese}
          onChange={setPaese}
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
          <V3DataTable
            colonne={colonne}
            righe={righe}
            chiave={(riga) => `${riga.fonte}-${riga.id}`}
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
    </PageFrame>
  );
}

export default ContattiPage;
