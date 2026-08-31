/**
 * Galassia V3 — la mappa viva dello standard.
 *
 * Non è una pagina decorativa: mostra in un colpo solo (a) i token grafici
 * realmente in uso, (b) i componenti standard così come appaiono nelle
 * maschere, (c) quanto è cresciuta la V3 modulo per modulo.
 * Se qualcosa qui è brutto o incoerente, è brutto o incoerente ovunque.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  V3_MODULE_LABELS,
  V3_PAGES,
  type V3ModuleId,
  type V3PageDefinition,
} from "@/v3/app/pageContract";
import { V3DataTable, type V3Colonna } from "@/v3/ui/DataTable";
import { CompanyLogo } from "@/v3/ui/CompanyLogo";
import { CountryFlag } from "@/v3/ui/CountryFlag";
import { StatoCircuitoBadge, InterazioniBadge } from "@/v3/ui/StatoBadge";
import { IntestazioneEntita } from "@/v3/ui/IntestazioneEntita";

function Blocco({
  titolo,
  regola,
  children,
}: {
  readonly titolo: string;
  readonly regola: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="v3-glass rounded-lg p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titolo}</h2>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{regola}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const TOKEN: readonly { readonly nome: string; readonly variabile: string }[] = [
  { nome: "Sfondo", variabile: "--background" },
  { nome: "Superficie", variabile: "--card" },
  { nome: "Blu primario", variabile: "--primary" },
  { nome: "Marrone accento", variabile: "--accent" },
  { nome: "Marrone secondario", variabile: "--secondary" },
  { nome: "Attenuato", variabile: "--muted" },
  { nome: "Bordo 1px", variabile: "--border" },
  { nome: "Errore", variabile: "--destructive" },
];

interface RigaEsempio {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly azienda: string;
  readonly dominio: string;
  readonly paese: string;
  readonly stato: string;
  readonly interazioni: number;
}

const RIGHE_ESEMPIO: readonly RigaEsempio[] = [
  {
    id: "1",
    nome: "Luca Arcanà",
    email: "luca@tmwe.it",
    azienda: "Transport Management SRL",
    dominio: "tmwe.it",
    paese: "Italy",
    stato: "engaged",
    interazioni: 178,
  },
  {
    id: "2",
    nome: "Gagan Deep Singh Bahri",
    email: "md@unitedseair.com",
    azienda: "United Seair Private Limited",
    dominio: "unitedseair.com",
    paese: "India",
    stato: "holding",
    interazioni: 2,
  },
  {
    id: "3",
    nome: "Luke Ratcliffe",
    email: "luke@mapcargo.co.uk",
    azienda: "Mapcargo Global Logistics",
    dominio: "mapcargo.co.uk",
    paese: "United Kingdom",
    stato: "new",
    interazioni: 0,
  },
];

const COLONNE: readonly V3Colonna<RigaEsempio>[] = [
  {
    id: "contatto",
    intestazione: "Contatto",
    ordinaPer: "nome",
    cella: (riga) => (
      <div className="flex min-w-0 items-center gap-2">
        <CompanyLogo dominio={riga.dominio} nome={riga.azienda} />
        <div className="min-w-0">
          <p className="truncate text-[13px] text-foreground">{riga.nome}</p>
          <p className="truncate text-[11px] text-muted-foreground">{riga.email}</p>
        </div>
      </div>
    ),
  },
  {
    id: "azienda",
    intestazione: "Azienda",
    ordinaPer: "azienda",
    cella: (riga) => <span className="truncate text-[13px] text-foreground">{riga.azienda}</span>,
  },
  {
    id: "paese",
    intestazione: "Paese",
    larghezza: "9rem",
    cella: (riga) => (
      <span className="flex items-center gap-1.5 text-[13px] text-foreground">
        <CountryFlag paese={riga.paese} />
        <span className="truncate">{riga.paese}</span>
      </span>
    ),
  },
  {
    id: "stato",
    intestazione: "Stato circuito",
    larghezza: "9rem",
    cella: (riga) => <StatoCircuitoBadge stato={riga.stato} />,
  },
  {
    id: "interazioni",
    intestazione: "Interazioni",
    larghezza: "6.5rem",
    cella: (riga) => <InterazioniBadge numero={riga.interazioni} />,
  },
];

const ORDINE_MODULI: readonly V3ModuleId[] = [
  "identita",
  "contatti",
  "messaggi",
  "comprensione",
  "risposta",
  "programmazione",
  "tracciamento",
  "trasversale",
];

export function GalassiaPage(): React.ReactElement {
  const [ordine, setOrdine] = React.useState({ campo: "nome", discendente: false });

  const perModulo = React.useMemo(() => {
    const mappa = new Map<V3ModuleId, V3PageDefinition[]>();
    for (const pagina of Object.values(V3_PAGES) as V3PageDefinition[]) {
      const lista = mappa.get(pagina.module) ?? [];
      lista.push(pagina);
      mappa.set(pagina.module, lista);
    }
    return mappa;
  }, []);

  const tutte = Object.values(V3_PAGES) as V3PageDefinition[];
  const attive = tutte.filter((p) => p.implemented).length;

  return (
    <PageFrame
      pageId="galassia"
      actions={
        <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <Link to="/v3/contatti">
            <Sparkles className="h-3.5 w-3.5" />
            Vedi lo standard applicato
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Crescita */}
        <Blocco
          titolo="Crescita della V3"
          regola={`${attive} maschere su ${tutte.length} sono innestate. Una pagina esiste solo se dichiarata nel contratto: niente rotte fantasma.`}
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {ORDINE_MODULI.map((modulo) => {
              const pagine = perModulo.get(modulo) ?? [];
              const fatte = pagine.filter((p) => p.implemented).length;
              const percentuale = pagine.length === 0 ? 0 : Math.round((fatte / pagine.length) * 100);
              return (
                <div key={modulo} className="rounded-md border border-border bg-card/50 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {V3_MODULE_LABELS[modulo]}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {fatte}/{pagine.length}
                    </span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percentuale}%` }} />
                  </div>
                  <ul className="mt-2 space-y-1">
                    {pagine.map((pagina) => (
                      <li key={pagina.path} className="flex items-center gap-1.5 text-[11px]">
                        {pagina.implemented ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                        ) : (
                          <Circle className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        )}
                        {pagina.implemented ? (
                          <Link
                            to={pagina.path}
                            className="truncate text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {pagina.title}
                          </Link>
                        ) : (
                          <span className="truncate text-muted-foreground/60">{pagina.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Blocco>

        {/* Colore */}
        <Blocco
          titolo="Colore"
          regola="Due sole famiglie: blu (struttura, azione, dato) e marrone (accento, attesa, provenienza). Nessun colore scritto a mano nei componenti: solo token."
        >
          <div className="flex flex-wrap gap-2">
            {TOKEN.map((token) => (
              <div key={token.variabile} className="w-36 rounded-md border border-border bg-card/50 p-2">
                <div
                  className="h-8 w-full rounded-[4px] border border-border"
                  style={{ backgroundColor: `hsl(var(${token.variabile}))` }}
                />
                <p className="mt-1.5 truncate text-[11px] text-foreground">{token.nome}</p>
                <p className="truncate text-[10px] text-muted-foreground">{token.variabile}</p>
              </div>
            ))}
          </div>
        </Blocco>

        {/* Tasti */}
        <Blocco
          titolo="Tasti"
          regola="Un tasto deve sembrare un tasto: bordo, sfondo, altezza fissa. Vietato nascondere un'azione dietro testo semplice. Il ritorno indietro ha sempre la freccia."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Indietro
            </Button>
            <Button size="sm" className="h-7 px-3 text-xs">
              Azione primaria
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
              Azione secondaria
            </Button>
            <Button variant="secondary" size="sm" className="h-7 px-3 text-xs">
              Accento
            </Button>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3 text-xs" disabled>
              Non disponibile
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </Button>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3 text-xs">
              Avanti
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Blocco>

        {/* Identità */}
        <Blocco
          titolo="Identità di un'entità"
          regola="Nelle schede di dettaglio l'azienda non va mai tra parentesi accanto al nome: sta nell'intestazione, con logo, bandiera e città."
        >
          <IntestazioneEntita
            nome="Luca Arcanà"
            ruolo="President"
            azienda="Transport Management SRL"
            citta="Bergamo"
            paese="Italy"
            email="luca@tmwe.it"
            badge={
              <>
                <StatoCircuitoBadge stato="holding" />
                <InterazioniBadge numero={178} />
              </>
            }
          />
        </Blocco>

        {/* Liste */}
        <Blocco
          titolo="Liste"
          regola="Una sola tabella: V3DataTable. Clic sull'intestazione ordina, clic su un valore filtra, stato circuito e interazioni sono sempre visibili."
        >
          <V3DataTable
            colonne={COLONNE}
            righe={RIGHE_ESEMPIO}
            chiave={(riga) => riga.id}
            ordinamento={ordine}
            onOrdina={(campo) =>
              setOrdine((corrente) => ({
                campo,
                discendente: corrente.campo === campo ? !corrente.discendente : false,
              }))
            }
          />
        </Blocco>

        {/* Badge */}
        <Blocco
          titolo="Badge di stato"
          regola="Il circuito di attesa è marrone, il dialogo è blu, il blocco è rosso. Le interazioni sono un numero evidenziato, mai un testo nascosto."
        >
          <div className="flex flex-wrap items-center gap-2">
            {["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"].map(
              (stato) => (
                <StatoCircuitoBadge key={stato} stato={stato} />
              ),
            )}
            <InterazioniBadge numero={0} />
            <InterazioniBadge numero={42} />
            <Badge variant="outline" className="text-[11px]">
              Punteggio 78
            </Badge>
          </div>
        </Blocco>

        <p className="pb-2 text-[11px] text-muted-foreground">
          Le regole complete stanno in <code className="text-foreground">docs/v3/standard-maschere.md</code>. Questa
          pagina è la loro verifica visiva: si aggiorna da sola man mano che la V3 cresce.
        </p>
      </div>
    </PageFrame>
  );
}

export default GalassiaPage;
