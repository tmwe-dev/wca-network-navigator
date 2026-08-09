# Suite di servizi + Cobra come orchestratore esterno

Modello target: una suite di programmi semplici, ciascuno specializzato e sostituibile,
collegati da API/eventi con contratti stabili. Navigator resta hub dati + UI/command center.

```text
                         +-------------------+
                         |   COBRA (esterno) |  orchestratore: DAG, fan-out,
                         |  workflow engine  |  retry, attese, aggregazione
                         +---------+---------+
                                   | job API + webhook/outbox
   +-----------+-----------+-------+-------+-----------+-----------+
   |           |           |               |           |           |
 Scraper    Research/    Funnemail      WCA Network   AI Platform  Agent
 (esterno)  Enrichment   (email svc)    (data src)    (capacita)   Framework
   |           |           |               |           |           |
   +-----------+-----------+-------+-------+-----------+-----------+
                                   |
                        +----------v-----------+
                        |  NAVIGATOR (hub)     |
                        |  UI, CRM, Pipeline,  |
                        |  Operational Dash    |
                        +----------------------+
```

Regola: lavoro semplice = chiamata diretta al servizio. Lavoro complesso = Navigator crea un
job su Cobra; Cobra compone il DAG e riporta stato/risultati; Navigator li visualizza e persiste.

## Classificazione: estrarre come servizio vs riorganizzare come modulo interno

| Area | Destino | Motivazione |
|---|---|---|
| Scraper / crawling / fetch pagine | Estrarre — servizio esterno | I/O pesante, rate-limit, proxy, anti-bot, rilascio proprio |
| Deep Search / Research-Enrichment | Estrarre — servizio esterno (consuma lo Scraper) | Batch lungo, retry, costo; consumabile da CRM, Sales, Agents, Command |
| Funnemail (classificazione, routing, autoresponder) | Estrarre — servizio email | Dominio chiuso con tabelle proprie `funnemail_*` |
| IMAP sync / invio email | Estrarre con Funnemail (worker) | Long-running, stateful, sensibile |
| WCA Network / TMWE bridge | Estrarre — fonte dati esterna | Già sistema terzo, accoppiato via `tmwe_*` |
| Orchestrazione workflow (missioni, campagne multi-step, autopilot) | Estrarre in Cobra | DAG, fan-out, attese, aggregazione |
| Agent Framework | Modulo interno ora, estraibile poi | Planning in Navigator, esecuzione su Cobra |
| AI Platform | Modulo interno con API pubblica | Capacità condivisa |
| CRM | Modulo interno estraibile | Cuore del data hub |
| Sales Intelligence / Pipeline / Deals | Modulo interno | Poco I/O esterno |
| Marketing Automation | Modulo interno + worker Cobra | Decisioni interne, esecuzione temporizzata esterna |
| Operational Dashboard | Modulo interno, aggregatore multi-servizio | Deve leggere stato job Cobra e salute servizi |
| Core Platform | Resta in Navigator | Nessuna estrazione |

## Stato attuale rilevato (2026-08-09)

- Cobra non esiste ancora nel repository: va creato da zero come servizio esterno.
- Lo scraping è oggi sparso su tre livelli: Edge Functions (`scrape-website`,
  `enrich-partner-website`, `batch-enrichment-worker`, `process-inbound-enrichment`,
  `ai-deep-search-helper`), client (`src/lib/api/wcaScraper.ts`,
  `src/lib/acquisition/scanDirectory.ts`, `hooks/useDeepSearch*`,
  `useFireScrapeExtensionBridge`) e tool Command (`scrapeCompanyWebsite`,
  `enrichPartnerFromWebsite`, `enrichProspectFromWebsite`).