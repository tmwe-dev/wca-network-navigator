

## Audit Completo WCA Network Navigator

L'utente vuole un'analisi profonda con **voto numerico**, **indice pagine/funzioni**, **audit sidebar (sx + dx)**, **audit flussi agenti AI** e **diagnosi finale di funzionabilità**. È un task di analisi pura (NESSUNA modifica al codice). Procedo in modalità default per avere accesso a `code--exec` (psql) e raccogliere metriche reali su KB, edge function logs, attività agenti, copertura prompt, attivazione filtri.

### Cosa farò (esecuzione end-to-end, output unico)

**Fase 1 — Inventario meccanico (script, no AI)**
1. **Indice pagine**: per ognuna delle 52 pagine `/v2/*`, leggo il primo blocco JSDoc + import dei componenti core ed estraggo le funzionalità reali (non finte). Output: tabella `path | scopo | feature principali | route attiva in sidebar?`.
2. **Indice funzioni inverso**: tutte le 32 tool-card del Command + le 90 edge functions raggruppate per dominio (Outreach, Inreach, AI, Scraping, Auth, Email Intelligence, Mission, Governance) con elenco delle pagine che le invocano.
3. **Mappa orfani vs sidebar**: cross-check rotte ↔ `LayoutSidebarNav.tsx` per evidenziare rotte definite ma non esposte (e viceversa link rotti).

**Fase 2 — Audit Sidebar Sinistra (navigazione)**
- Verifico ogni gruppo (`group_ai_command`, `group_overview`, `group_communication`, `group_intelligence`, `group_ai_operations`, `group_system`): coerenza semantica, eventuali doppioni o vuoti.
- Mancanze sospette: `Email Intelligence` isolato in Intelligence ma senza `Inbox` correlata; `AI Control` lontano da `Approvazioni`; nessun ingresso a `Acquisizione Partner`, `Contacts`, `Prospects` (sono sotto-rotte CRM senza link diretto in sidebar).

**Fase 3 — Audit Sidebar Destra (`MissionDrawer` + `FiltersDrawer`)**
- Per le rotte principali (Network, CRM, Outreach, Inreach, Agenda, Campaigns, Settings, Agents, AI-Staff, Research) verifico:
  - **MissionDrawer**: quali `ContextActionPanel` esistono e se gli eventi `CustomEvent` hanno listener. Già mappato: solo Network/CRM/Settings hanno azioni; **Outreach, Inreach, Agenda, Campaigns, Agents, Research → drawer mostra solo template generico (Goal/Proposta/Docs) senza azioni di pagina.** Questa è una **lacuna grossa**.
  - **FiltersDrawer**: copertura per route (`useFiltersDrawerState`). Già visto: copre Cockpit/Workspace/InUscita/Circuito/Attività/Inbox/Inreach/Network/CRM/BCA/Campaigns/Agenda/EmailComposer. **Mancano: Agents, AI-Staff, AI-Control, Research/RA, Sorting, Globe, AI-Arena → drawer aperto = vuoto.**
- Verifico se gli action handler dispatchati (`crm-deep-search`, `crm-linkedin-lookup`, `enrichment-batch-start`, ecc.) hanno effettivamente un `useMissionDrawerEvents` listener nelle pagine target. Sospetto **eventi orfani**.

**Fase 4 — Audit Intelligenza AI**
- Leggo `composeSystemPrompt` + `assemblePrompt` + i 9 core prompt (`luca`, `super-assistant`, `contacts-assistant`, `cockpit-assistant`, `email-improver`, `email-classifier`, `daily-briefing`, `query-planner`, `ai-arena`).
- Verifico **routing scope→prompt**: `unified-assistant` accetta 10 scope ma `composeSystemPrompt` ne discrimina solo per stringa generica (no rules per scope nel codice). Risultato: cockpit/contacts/import/extension/strategic ricevono **lo stesso prompt LUCA** + un'intestazione `🎯 SCOPE ATTIVO:` → dipendenza completa dalla KB per la differenziazione.
- Verifico copertura KB delle dottrine citate nei prompt:
  - `procedures/lead-qualification-v2`, `procedures/post-send-checklist`, `procedures/whatsapp-message`, `procedures/email-improvement-techniques`, `procedures/ai-query-engine`, `doctrine/safety-guardrails`, `doctrine/anti-hallucination`, `doctrine/tone-and-format`, `LEGGE FONDAMENTALE Holding Pattern`, `Dottrina Multi-Canale`, `Dottrina Uscite`, `Progressione Relazionale`. Verifico via SQL (`kb_entries WHERE title IN (...)`).
- Verifico tool execution chain:
  - `resolveTool` (registry.ts) → `decideToolFromPrompt` (ai-assistant tool-decision mode) → tool execution → side effects.
  - Verifico se `aiQueryTool` (fallback finale) ha effettivamente schema di tabelle whitelist coerente con `query-planner` prompt.
- Verifico esistenza dei `tool_id` dichiarati in `WRITE_TOOL_IDS`/`ACTION_TOOL_IDS` rispetto alle edge functions effettive (es. `scrape-linkedin-profile` esiste come edge? `browser-navigate-extract`?).
- Verifico `operative_prompts` table: query DB ha mostrato **0 righe attive** → la promessa di "operative_prompts strutturati" del memory è **non implementata in produzione** (potenziale gap).

**Fase 5 — Diagnosi flussi end-to-end**
Per i 5 flussi critici, traccio chain completa e marco rotture:
1. **Outreach Plan→Approve→Execute**: Mission Builder → mission_actions → Approvazioni (`/v2/sorting`) → `pending-action-executor` → send-* → outreach_queue.
2. **Inreach reply tracking**: check-inbox → channel_messages → `on_inbound_message` trigger → activity creata → outreach_queue replied.
3. **AI Command** (`/v2/command`): user prompt → `resolveTool` → tool execution → toast/UI action via `ai-ui-action` event.
4. **Daily Briefing**: cron → `daily-briefing` edge → JSON actions → dashboard.
5. **Mission Autopilot**: cron → `agent-autopilot-worker` → `acquire_mission_slot` RPC → tool → side effects.

**Fase 6 — Voto e raccomandazioni**
- Voto da 1 a 100.000 con motivazione dimensionata su 5 assi: Architettura (0–20k), UX/Navigazione (0–20k), AI/KB (0–25k), Affidabilità Flussi (0–20k), Sicurezza/Governance (0–15k).
- Top-10 problemi che possono **impedire il funzionamento** (con criticità HIGH/MED/LOW e fix proposto).
- Top-5 quick win.

### Output finale (in chat, italiano)
1. Voto + motivazione sintetica (5 punti).
2. **Indice pagine** (52 pagine, tabella).
3. **Indice funzioni** (raggruppate, con pagine consumatrici).
4. **Audit Sidebar Sinistra** (gap + ridondanze).
5. **Audit Sidebar Destra** (MissionDrawer + FiltersDrawer per route, eventi orfani).
6. **Audit Intelligenza AI** (prompt↔KB↔tool↔scope coverage matrix).
7. **5 flussi critici end-to-end** con marcatura rotture.
8. **Top-10 bloccanti** + **Top-5 quick win**.

Nessuna modifica al codice. Solo lettura, query DB, e analisi. Tempo stimato: 1 turno lungo.

