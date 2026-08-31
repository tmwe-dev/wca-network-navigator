# D5 — Inventario delle funzioni presenti solo in V2

Data: 2026-08-31. Prerequisito: D4 (due porte d'ingresso, V2 marcata legacy).

## 1. Perché

La V3 copre il ciclo del messaggio (22 maschere). Tutto ciò che sta fuori da quel ciclo vive
ancora solo in V2. Questo documento elenca quelle funzioni, dice quali si portano in V3 e quali no,
e non tocca il codice esistente.

## 2. Le funzioni solo-V2, per famiglia

### A — Acquisizione lead (resta in V2, decisione D2)
| Funzione | Rotta V2 | Motivo |
| --- | --- | --- |
| RA Explorer | `/v2/ra-explorer` | Motore di ricerca aziende, superficie molto specifica |
| RA Scraping Engine | `/v2/ra-scraping` | Code e job di estrazione |
| Deep Search | `/v2/deep-search` | Ricerca a tre livelli |
| Acquisizione partner | `/v2/acquisition` | Qualifica pre-CRM |
| Prospect | `/v2/prospects` | Anticamera del CRM |
| Network | `/v2/network` | Mappa relazionale (unica pagina con telemetria significativa) |
| Finder API | `/v2/finder-api` | Interrogazione fonti dati |
| Sorting | `/v2/sorting` | Smistamento massivo |

La V3 ne legge i risultati (contatti, partner) tramite il DAL: nessun import da V2.

### B — Laboratorio AI (resta in V2)
Prompt Lab, Catalogo prompt, KB Supervisor, AI Lab, AI Test Hub, Email Lab, Email Forge,
Brand Voice, Capacità agenti. Uso raro, alto valore, forte accoppiamento con strutture di configurazione.

### C — Osservabilità e diagnostica (resta in V2)
Diagnostica, Osservabilità, Telemetria, Tracce pipeline, Token Cockpit, Galassia di sistema.

### D — Da dismettere (nessuna migrazione)
Dashboard doppie (`SimpleHomePage`, `DashboardPage`, `CockpitPage`), onboarding guidati,
`LandingPage`/`DocsPage`/`DPAPage` se non servono al pubblico, superfici vocali (D3).
Prima strumentazione, poi 30 giorni di osservazione, poi rimozione.

## 3. Decisione

Nessuna migrazione di queste funzioni verso V3. Si aggiunge invece **un solo ingresso** dalla V3:

- Pagina `/v3/laboratorio` (maschera operativa, modulo trasversale, dichiarata in `pageContract.ts`).
- Raggruppa Acquisizione, Laboratorio AI, Osservabilità in un catalogo cercabile.
- Ogni voce apre la pagina V2 in una nuova scheda: la sessione di lavoro in V3 non si interrompe.
- Zero codice V2 importato in V3, zero modifiche alle pagine V2.

## 4. Cosa serve prima di un eventuale ritiro della V2

1. Strumentare `page_events` sulle pagine dei gruppi A/B/C (oggi 5 su 91).
2. Strumentare `edge_metrics` sulle funzioni (oggi 37 su ~150).
3. 30 giorni di uso reale con la V3 come porta d'ingresso.
4. Solo allora: rimozione del gruppo D e delle rotte del gruppo A ormai vuote.
