/**
 * Laboratorio — maschera Operativa. "Dove sono le funzioni che non stanno nel ciclo del messaggio?"
 *
 * Non migra nulla: è l'unico ingresso dalla V3 verso le superfici che restano in V2
 * (acquisizione lead, laboratorio AI, osservabilità). Vedi docs/v3/d5-inventario-v2-only.md.
 */
import * as React from "react";
import { ExternalLink, FlaskConical, Radar, Activity, Search } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { V3_PAGINE_SECONDARIE } from "@/v3/app/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Voce {
  readonly titolo: string;
  readonly descrizione: string;
  readonly path: string;
}

interface Gruppo {
  readonly id: string;
  readonly titolo: string;
  readonly nota: string;
  readonly icona: React.ComponentType<{ className?: string }>;
  readonly voci: readonly Voce[];
}

const GRUPPI_V2: readonly Gruppo[] = [
  {
    id: "acquisizione",
    titolo: "Acquisizione lead",
    nota: "Resta in V2 per decisione D2: la V3 ne legge solo i risultati.",
    icona: Radar,
    voci: [
      { titolo: "RA Explorer", descrizione: "Ricerca aziende su ReportAziende.", path: "/v2/ra-explorer" },
      { titolo: "RA Scraping Engine", descrizione: "Motore di estrazione e code di scraping.", path: "/v2/ra-scraping" },
      { titolo: "Deep Search", descrizione: "Ricerca profonda a tre livelli sul web.", path: "/v2/deep-search" },
      { titolo: "Acquisizione partner", descrizione: "Flusso di acquisizione e qualifica.", path: "/v2/acquisition" },
      { titolo: "Prospect", descrizione: "Elenco prospect prima dell'ingresso in CRM.", path: "/v2/prospects" },
      { titolo: "Network", descrizione: "Mappa relazionale dei partner.", path: "/v2/network" },
      { titolo: "Finder API", descrizione: "Interrogazione diretta delle fonti dati.", path: "/v2/finder-api" },
      { titolo: "Sorting", descrizione: "Smistamento massivo dei contatti acquisiti.", path: "/v2/sorting" },
    ],
  },
  {
    id: "laboratorio",
    titolo: "Laboratorio AI",
    nota: "Uso raro, alto valore: si usa per configurare, non per lavorare.",
    icona: FlaskConical,
    voci: [
      { titolo: "Prompt Lab", descrizione: "Simulatore e versioni dei prompt.", path: "/v2/prompt-lab" },
      { titolo: "Catalogo prompt", descrizione: "Registro dei prompt di sistema.", path: "/v2/prompt-lab/catalog" },
      { titolo: "KB Supervisor", descrizione: "Documenti di knowledge base.", path: "/v2/kb-supervisor" },
      { titolo: "AI Lab", descrizione: "Prove libere sui modelli.", path: "/v2/ai-lab" },
      { titolo: "AI Test Hub", descrizione: "Test di regressione sulle risposte AI.", path: "/v2/ai-test-hub" },
      { titolo: "Email Lab", descrizione: "Prove di rendering e deliverability.", path: "/v2/email-lab" },
      { titolo: "Email Forge", descrizione: "Costruzione template email.", path: "/v2/email-forge" },
      { titolo: "Brand Voice", descrizione: "Tono di voce e regole editoriali.", path: "/v2/lab?group=brand" },
      { titolo: "Capacità agenti", descrizione: "Strumenti abilitati per ciascun agente.", path: "/v2/agents/capabilities" },
    ],
  },
  {
    id: "osservabilita",
    titolo: "Osservabilità e diagnostica",
    nota: "Serve quando qualcosa non torna. Sola lettura.",
    icona: Activity,
    voci: [
      { titolo: "Diagnostica", descrizione: "Stato dei servizi e controlli rapidi.", path: "/v2/settings/diagnostics" },
      { titolo: "Osservabilità", descrizione: "Metriche edge function e allarmi.", path: "/v2/settings/observability" },
      { titolo: "Telemetria", descrizione: "Eventi di pagina e uso reale.", path: "/v2/settings/telemetry" },
      { titolo: "Tracce pipeline", descrizione: "Percorso completo di una elaborazione.", path: "/v2/pipeline-traces" },
      { titolo: "Token Cockpit", descrizione: "Consumo token e budget AI.", path: "/v2/token-cockpit" },
      { titolo: "Galassia di sistema", descrizione: "Mappa 3D di moduli e connessioni.", path: "/v2/galaxy" },
    ],
  },
];

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/** Maschere V3 fuori dalle 6 sezioni: restano attive, ma si aprono da qui. */
const GRUPPO_V3_SECONDARIE: Gruppo = {
  id: "v3-secondarie",
  titolo: "Maschere V3 secondarie",
  nota: "Fuori dalle 6 sezioni del perimetro: utili di tanto in tanto, non nel lavoro quotidiano.",
  icona: FlaskConical,
  voci: V3_PAGINE_SECONDARIE.map((p) => ({
    titolo: p.title,
    descrizione: p.question,
    path: p.path,
  })),
};

const GRUPPI: readonly Gruppo[] = [GRUPPO_V3_SECONDARIE, ...GRUPPI_V2];

export function LaboratorioPage(): React.ReactElement {
  const [ricerca, setRicerca] = React.useState("");

  const gruppiFiltrati = React.useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return GRUPPI;
    return GRUPPI.map((g) => ({
      ...g,
      voci: g.voci.filter(
        (v) => v.titolo.toLowerCase().includes(q) || v.descrizione.toLowerCase().includes(q),
      ),
    })).filter((g) => g.voci.length > 0);
  }, [ricerca]);

  const totale = GRUPPI.reduce((acc, g) => acc + g.voci.length, 0);

  const workflow = (
    <>
      <RailGroup label="Contenuto">
        {GRUPPI.map((g) => (
          <p key={g.id} className="text-xs text-muted-foreground">
            {g.titolo}: {g.voci.length}
          </p>
        ))}
      </RailGroup>
      <RailGroup label="Nota">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Queste superfici restano nella versione completa (V2). Da qui si aprono in una nuova scheda: la sessione di
          lavoro in V3 non si perde.
        </p>
      </RailGroup>
    </>
  );

  const toolbar = (
    <>
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca una funzione…"
          className="h-8 pl-7 text-sm"
        />
      </div>
      <span className="text-xs text-muted-foreground">{totale} funzioni</span>
    </>
  );

  return (
    <PageFrame pageId="laboratorio" workflow={workflow} toolbar={toolbar}>
      <div className="space-y-6">
        {gruppiFiltrati.map((gruppo) => {
          const Icona = gruppo.icona;
          return (
            <section key={gruppo.id}>
              <div className="mb-2 flex items-center gap-2">
                <Icona className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{gruppo.titolo}</h2>
                <Badge variant="secondary" className="text-[10px]">
                  {gruppo.voci.length}
                </Badge>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{gruppo.nota}</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {gruppo.voci.map((voce) => (
                  <a
                    key={voce.path}
                    href={voce.path}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{voce.titolo}</span>
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{voce.descrizione}</p>
                  </a>
                ))}
              </div>
            </section>
          );
        })}

        {gruppiFiltrati.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">Nessuna funzione corrisponde alla ricerca.</p>
        )}
      </div>
    </PageFrame>
  );
}

export default LaboratorioPage;
