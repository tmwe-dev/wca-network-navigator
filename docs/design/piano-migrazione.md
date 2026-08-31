# Piano di migrazione grafica — a ondate

Principio guida: **la priorità non è cambiare l'aspetto, è non rompere ciò che funziona.**
Ogni ondata tocca solo presentazione: nessuna modifica a query, hook, DAL, edge function,
routing o database.

## Ordine delle ondate

### Ondata 0 — Fondamenta (nessuna pagina toccata)
1. Applicare i token Midnight Indigo a `index.css` (tema scuro di default).
2. Estendere `layoutTokens.ts` con densità, spaziature e scala tipografica.
3. Creare i componenti condivisi mancanti: `KpiStrip`, `EntityRow`, `StatusDot`,
   `BadgeGroup` (con `+N`), `PanelSection`, `EmptyState`, `LoadingPanel`.
4. Aggiungere la regola ESLint sui colori grezzi in **warning** (non blocca ancora).

**Criterio di uscita**: l'app gira identica, i nuovi componenti esistono e sono
visibili in Design System Preview.

### Ondata 1 — Prototipo
Solo **Missioni Autopilot**, secondo `prototipo-missioni-autopilot.md`.
Serve a validare i componenti dell'Ondata 0 sul campo.

**Criterio di uscita**: la pagina rispetta la checklist del contratto e l'utente
la approva come metro per tutte le altre.

### Ondata 2 — Monitor / KPI (17 pagine)
Cockpit, Analytics, KPI, Telemetria, Observability, Diagnostica,
Email Intelligence, Pipeline Traces, Campaign Jobs, Token Cockpit, Dashboard, E2E Status,
RA Dashboard, Operations, AI Interaction Log, Email Intelligence Operations.

### Ondata 3 — Elenco → Dettaglio (15 pagine)
Network/Partner, Contatti, Comms, Inbox, Funnemail, Rubriche WA e LinkedIn,
Prospects, RA Explorer, RA Company Detail, Acquisizione, Catalogo Prompt, Clienti TMWE, Outreach.
È l'ondata con più impatto percepito: è la schermata dello screenshot di riferimento.

### Ondata 4 — Flusso operativo (12 pagine)
Approvazioni, Sorting, Cestinone, Agenda, Notifiche, Deep Search, Email Download,
RA Scraping, Agent Tasks, Calendar, Onboarding guidato.

### Ondata 5 — Editor / Configurazione (18 pagine)
Config, Persona, Prompt Lab, Strategie Email, Brand Voice, Routing AI, Alert,
Capabilities, Mission Builder, DPA, Admin Users, KB Supervisor, Email Composer,
Email Forge, Email Lab, AI Lab.

### Ondata 6 — Hub (13 pagine)
Lab, AI Staff, Agenti, Chi fa cosa, CRM, Guida, Docs, Finder API, Brain, Staff,
Design System Preview, AI Test Hub, Simple Home.

### Ondata 7 — Chiusura
1. `PageShell` e `PageTitleHeader` rimossi; resta solo `StandardPageFrame`.
2. Regola ESLint sui colori portata a **error**.
3. Pagine full-bleed (Globo, Campagne, Galassia, Command): solo verifica palette.

## Criterio di uscita valido per ogni ondata

- [ ] Ogni pagina dell'ondata passa la checklist di `contratto-pagina.md`
- [ ] Contatore colori fuori palette sceso rispetto all'ondata precedente
- [ ] `tsgo --noEmit` pulito
- [ ] Nessun diff in file di `src/data`, `src/v2/hooks`, `supabase/functions`
- [ ] Smoke test di navigazione verde sulle rotte toccate

## Regole di sicurezza durante la migrazione

1. Una pagina per volta, mai un refactor trasversale «già che ci siamo».
2. Non spostare logica: se un calcolo è dentro il JSX, resta dov'è finché
   la migrazione grafica non è chiusa.
3. Non toccare i nomi dei campi né le chiavi di cache React Query.
4. Non eliminare funzionalità: ciò che sparisce dalla vista principale deve
   essere raggiungibile dal menu «…» o dal livello 2.
5. Nessun cambiamento al menu di navigazione in questa migrazione.

## Metriche di successo

| Metrica | Oggi | Obiettivo |
| --- | --- | --- |
| Gusci di pagina diversi | 4 | 1 |
| Pagine senza guscio | 40 | 0 |
| Colori fuori palette in `src/v2` | 205 | 0 |
| Esadecimali nel JSX | 11 | 0 |
| Informazioni di livello 1 per riga (Partner) | 14 | 5 |
| Azioni visibili in header | fino a 9 | 3 + «…» |
