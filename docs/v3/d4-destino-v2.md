# D4 — Destino della V2 (ripresa a Modulo 7 chiuso)

Data: 2026-08-30. Stato: V3 completa su tutte le 22 voci del contratto, verificata su dati reali.

## 1. Fotografia

- V2: 91 pagine, ~200 rotte (molte sono già alias/redirect interni).
- V3: 22 pagine, un solo guscio (`PageFrame`), un solo router, nessun import da V2 (regola di lint).
- Telemetria pagine (`page_events`, ultimi 120 giorni): **5 sole pagine** hanno eventi
  (`network` 846, `/v2/explore/contacts` 37, `staff_direzionale` 20, `telemetry` 13, `brand-voice` 7).
  La strumentazione è parziale: l'assenza di eventi **non è prova** di non uso (vale la regola dei 30 giorni).

## 2. Le 91 pagine V2 in quattro destini

### A — Sostituite dalla V3 (il lavoro quotidiano)
Inbox/Funnemail, Comms, Rubrica WA/LinkedIn, Contatti, CRM, Pipeline, Duplicati, Cestinone,
Approvazioni, Composer/Email, Campagne, Coda, Agenda/Calendar, Operatori/Staff, Settings,
Command, Analytics/KPI, AI Interaction Log, Regole/Sorting, Email Intelligence.
→ Destino: **redirect verso la pagina V3 equivalente**, una volta che l'operatore lavora in V3.

### B — Da mantenere in V2 per sempre (decisione D2)
Acquisizione: RA Explorer, RA Dashboard, RA Company Detail, RA Scraping Engine, Deep Search,
Acquisizione Partner, Prospect, Network/Globe, Finder API, Import/Download email massivi.
→ Destino: **restano dove sono**, la V3 ne legge solo i risultati.

### C — Laboratorio e diagnostica (uso raro, alto valore)
Prompt Lab, Prompt Catalog, KB Supervisor, AI Lab / AI Arena / AI Test Hub, Email Lab, Email Forge,
Brand Voice, Diagnostics, Observability, Telemetry, E2E Status, Pipeline Traces, System Galaxy,
Token Cockpit, Design System Preview.
→ Destino: **raggruppare sotto un unico ingresso "Laboratorio"** raggiungibile dalla V3, senza migrarle.

### D — Da dismettere
Superfici vocali (D3: Aurora/ElevenLabs), doppioni di dashboard (`SimpleHomePage`, `DashboardPage`,
`CockpitPage` vs `OutreachPage`), onboarding guidati non più usati, `LandingPage`/`DocsPage`/`DPAPage`
se non servono al pubblico.
→ Destino: **spegnimento graduale**, prima strumentazione + 30 giorni di osservazione.

## 3. Raccomandazione

Non spegnere la V2 in un colpo solo. Tre passi, ognuno reversibile:

1. **V3 come porta d'ingresso** (`/` → `/v3/...`), V2 ancora raggiungibile a `/v2/*`.
   Serve una sola riga di routing e si torna indietro in un minuto.
2. **Redirect del gruppo A** verso la V3, tenendo `/v2/*` vivo per B e C.
3. Dopo 30 giorni di uso reale: rimozione del codice del gruppo D e delle rotte A ormai vuote.

Prerequisito per il passo 3: strumentare `page_events`/`edge_metrics` sulle superfici sopravvissute —
oggi loggano 37 edge function su 150 e 5 pagine su 91.

## 4. Cosa NON cambia in nessuno scenario

- Acquisizione lead (gruppo B) resta in V2.
- Nessuna riscrittura di edge function per motivi di UI.
- La V3 continua a non importare da V2.
