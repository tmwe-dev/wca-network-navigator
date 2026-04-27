# Piano — Audit completo + Guida con screenshot reali + Roadmap Q2-Q4

## Risultati dell'audit

### Navigazione (`/v2/*`)
- **88 rotte dichiarate** in `src/v2/routes.tsx`, **24 voci** nella `navConfig.tsx`. Verificato programmaticamente: tutte le voci del menu puntano a una rotta esistente (zero "MISSING").
- Le pagine che davano "errore e non si aprono" derivavano dal bug realtime già risolto (`useNotifications` + `useUnreadCount` + `SenderManagementTab` con channel name statico). Niente di rotto a livello di routing.
- `LayoutSidebarNav` funziona: scroll OK, gruppi OK, attivo evidenziato, prefetch al hover.
- Resta una micro-glitch: `groupIdx === 0` aggiunge un divider, ma non c'è separatore tra gli altri gruppi → li rendo coerenti (tutti i gruppi uniformi, leggibilità migliore).

### Guida attuale (`/v2/guida`)
- Architettura solida: `GuidaLayout` con scroll-snap verticale, `ScrollIndicator` con dots, progress bar in alto, palette `#0a0a0f` + accenti primary/blu/violet.
- **Problema centrale**: gli "screenshot" sono mock JSX statici (`screenshotContent` con `<div>` finti), non screenshot reali del prodotto. Vanno sostituiti.
- Le 8 sezioni Tutorial sono incomplete rispetto al menu reale (24 voci) → mancano almeno: CRM, Inreach, Approvals/Sorting, Globe, Research, Email Intelligence, Prompt Lab, Agents, Missions, AI Staff, AI Arena, AI Control, Token Cockpit, Notifications.
- La sezione `RoadmapSection` è statica e generica (nessuno "step di realizzazione").

### Stato reale Q2/Q3/Q4 (per piano realistico)
- **Q2** — fondamenta presenti: `RAScrapingEnginePage`, `RAExplorerPage`, `OperationsPage`, voice infra (`VoiceLanguageSelector`, ElevenLabs prompts in `docs/`), `AnalyticsPage` + `KpiPage`. Mancano: agente autonomo "ricerca aziende end-to-end", outbound calling completo, dashboard analytics avanzata.
- **Q3** — assente: nessuna tabella `tenants/organizations`, zero codice Salesforce/HubSpot, nessuna shell mobile (solo `MobileBottomNav`).
- **Q4** — assente: nessun `marketplace`, nessun `negotiation_assistant`, nessun `predictive_score`/`ml_score`.

## Cosa farò

### 1. Audit & navigazione — chiusura definitiva
- Conferma scritta nel file `docs/audit/NAVIGATION-AUDIT-<oggi>.md`: 24/24 voci OK, 88 rotte, errori risolti.
- Patch micro: in `LayoutSidebarNav.tsx` rendo i divider tra gruppi uniformi (estetica più pulita) e aggiungo `aria-current="page"` al pulsante attivo (a11y).

### 2. Guida — screenshot reali

**Approccio**: screenshot generati via browser headless del progetto in preview, salvati come asset statici, montati nei tutorial al posto dei mock.

- Nuovo componente `RealScreenshot.tsx` in `src/components/guida/` che renderizza l'immagine dentro `ScreenshotFrame` con fallback elegante se l'asset manca (mostra il mock attuale per non rompere mai).
- Cartella nuova `src/assets/guida/screenshots/` con immagini PNG/WebP per ogni pagina del menu.
- Generazione: uso il browser tool su preview autenticata, navigo ognuna delle 24 rotte, screenshot 1440×900 normalizzato, salvo in `src/assets/guida/screenshots/<slug>.png`. Le immagini vengono importate come ES module → bundling Vite + lazy load.
- Aggiornamento di `GuidaPage.tsx`:
  - Sostituisco i mock `screenshotContent` con `<RealScreenshot src={shotCRM} />` per le 8 sezioni esistenti.
  - **Aggiungo 8 sezioni Tutorial** per coprire le aree oggi assenti: CRM Hub, Inreach, Email Intelligence, Globe, Deep Research, Prompt Lab, Missions Autopilot, AI Control Center.
- Per ogni nuova sezione: descrizione operativa + lista 5 features + screenshot reale + (nuovo) box "Comandi" con i 2-3 click che servono per arrivare al risultato (es. "CRM → Filtri → IATA").

### 3. Allineamento grafico
- Stesso `SectionWrapper`, stesso `bg-[#0a0a0f]`, stessi gradient primary/blu/violet, stesso pattern reverse alternato.
- Lo stile dei nuovi blocchi "Come si arriva" usa la palette esistente (badge primary + lista accent).
- Consistente: ogni Tutorial avrà esattamente la stessa struttura → testo + screenshot reale + features + "comandi rapidi".

### 4. Roadmap dettagliata Q2/Q3/Q4

Riscrivo `RoadmapSection.tsx` per mostrare, oltre al titolo della feature, **gli step concreti** (3-5 per quarter) basati sullo stato attuale del codice. Le voci Q2/Q3/Q4 fornite dall'utente vengono espanse così:

```text
Q2 2026 — fondamenta già parzialmente presenti
─────────────────────────────────────────────
1) Ricerca autonoma Report Aziende via agente
   • Step A — Estendere RAScrapingEnginePage in modalità "loop autonomo" guidato da agent_missions.
   • Step B — Aggiungere tool agent register_search_topic (scrive su agent_tasks).
   • Step C — Cron pg_cron che drena la coda e chiama scrape-then-enrich.
2) Voice AI per chiamate outbound
   • Step A — Edge function bridge ElevenLabs Realtime + Twilio Voice (audio bidirezionale).
   • Step B — Tabella call_sessions con trascrizione streaming.
   • Step C — UI in /v2/agents/missions per pianificare chiamata + revisione trascript.
3) Dashboard analytics avanzata
   • Step A — Materialized view daily_kpis (open rate, reply rate, deal velocity).
   • Step B — AnalyticsPage v2 con drill-down per operatore, paese, agente.
   • Step C — Export CSV/PDF reportistica settimanale.

Q3 2026 — multi-tenant e integrazioni esterne
─────────────────────────────────────────────
1) Multi-tenant: più aziende sullo stesso sistema
   • Step A — Schema: tabella organizations + colonna org_id su tutte le tabelle business.
   • Step B — Migrazione dati: assegnare org_id a record esistenti (default org).
   • Step C — Riscrittura RLS: ogni policy aggiunge AND org_id = current_org_id().
   • Step D — UI org switcher nell'header per admin multi-org.
2) Integrazione CRM esterni (Salesforce, HubSpot)
   • Step A — Edge function crm-sync con OAuth2 broker per Salesforce.
   • Step B — Mapping bidirezionale partner ↔ Account, contact ↔ Contact.
   • Step C — Webhook in entrata per aggiornamenti dal CRM esterno.
   • Step D — Stessa pipeline duplicata per HubSpot.
3) App mobile per approvazioni on-the-go
   • Step A — Capacitor wrapper sopra la PWA esistente (riusa MobileBottomNav).
   • Step B — Push notification via Lovable Cloud per nuove approvazioni.
   • Step C — Vista Sorting/Approvals semplificata mobile-first.
   • Step D — Build iOS+Android, pubblicazione store.

Q4 2026 — marketplace e ML
─────────────────────────────────────────────
1) Marketplace servizi tra partner
   • Step A — Tabelle service_offers, service_requests, service_matches.
   • Step B — Pagina /v2/marketplace con filtri per corridoio, modalità, certificazioni.
   • Step C — Workflow di richiesta quotazione integrato con outreach_queue esistente.
2) AI negotiation assistant
   • Step A — Prompt operativo "negotiator" in operative_prompts.
   • Step B — Tool agent suggest_counter_offer con context da deal storico.
   • Step C — UI in /v2/deals con pannello laterale "Negotiation copilot".
3) Predictive scoring con ML
   • Step A — Edge function ml-train che lavora su email_classifications + activities storiche.
   • Step B — Modello scikit-learn (logistic regression) servito via edge function ml-score.
   • Step C — Colonna predicted_conversion_score su contacts + filtri CRM.
   • Step D — Retraining settimanale via pg_cron.
```

Visivamente: 3 colonne come oggi, ma ogni feature è un `<details>` espandibile con gli step (default chiuso → guida resta scrollable; aperto → mostra il piano concreto).

## Dettagli tecnici

**File nuovi**
- `src/components/guida/RealScreenshot.tsx`
- `src/assets/guida/screenshots/*.png` (24 file)
- `docs/audit/NAVIGATION-AUDIT-2026-04-27.md`

**File modificati**
- `src/components/guida/RoadmapSection.tsx` — nuovo modello dati con `steps[]`, UI espandibile.
- `src/v2/ui/pages/GuidaPage.tsx` — usa `RealScreenshot`, aggiunge 8 nuove sezioni Tutorial.
- `src/components/guida/TutorialSection.tsx` — nuovo prop opzionale `commands?: string[]` per il box "comandi rapidi".
- `src/v2/ui/templates/LayoutSidebarNav.tsx` — divider uniformi + `aria-current`.

**Workflow screenshot (read-only mockup non possibile in plan mode; verrà fatto in build mode)**
1. Browser tool: `navigate_to_sandbox` su preview autenticata.
2. Per ogni voce di `navConfig.tsx`: navigate, attesa render, `screenshot`, salvataggio binario in `src/assets/guida/screenshots/`.
3. Re-import nei tutorial.

**Garanzie**
- Nessuna modifica al routing, all'auth, al backend.
- Tutti gli screenshot vengono catturati nel viewport 1440×900, ritagliati per uniformità.
- Se un asset manca, il fallback mostra il mock attuale → la guida non si rompe mai.
- Bundle: le immagini vanno in `src/assets/` e vengono code-split → la guida non pesa per chi non la apre (lazy chunk già presente per `GuidaPage`).

## Cosa NON tocco
- AuthProvider / useAuthV2 / RLS / database — già auditati nei turni precedenti, nessuna regressione.
- Nessuna nuova feature backend per Q2/Q3/Q4: la roadmap è **descrittiva**, non implementativa. Implementazione = lavoro futuro, oggi solo planning.
- Nessuna riscrittura dei tutorial già esistenti se il contenuto è ancora valido (sostituisco solo il mock con screenshot reale).

## Output atteso
- Guida `/v2/guida` con 16 sezioni tutorial (8 attuali + 8 nuove), tutte con screenshot reali del prodotto live.
- Sezione Roadmap con step concreti e cliccabili per Q2, Q3, Q4.
- Documento d'audit della navigazione che certifica 0 link rotti.
- Stesso look & feel della guida attuale, zero regressioni.
