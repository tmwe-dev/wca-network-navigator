
# Split documento "Funnemail – istruzioni messaggi e operativo"

## Principio guida
- **Mai scrittura diretta** su `operative_prompts` o `kb_entries`: tutto passa da `prompt_change_proposals` / `kb_entry_proposals` (governance Prompt Copilot, ADR 0004).
- **Doctrine sovraordinate intoccabili**: TMWE, holding pattern, editorial review obbligatorio, lead status guard, no-physical-delete. Se il documento confligge, vince la doctrine.
- **3 destinazioni** per ogni sezione: 🟢 KB nuova · 🟡 Patch prompt esistente · 🔵 Già coperto (cito) · 🔴 Feature backlog (non tocco ora).

---

## Parte A — 9 schede KB nuove (proposte in `kb_entry_proposals`)

| # | Titolo | Categoria | Priority | Sezioni doc | Perché |
|---|--------|-----------|----------|-------------|--------|
| 1 | **Continuità operativa: ogni azione crea il prossimo step** | `doctrine` | 9 | §1, §3, §24, §26 | Principio madre del sistema. Va sempre nel contesto di Funnemail e Outreach. |
| 2 | **Findaire value proposition (KB commerciale)** | `sales_doctrine` | 9 | §9 (gruppo, automazioni, vantaggi economici, velocità, affidabilità, copertura globale) | Oggi assente. Serve a `generate-email`, `generate-outreach`, risposte interesse. |
| 3 | **Tassonomia risposte campagne (fredda/scarso int./partner cerca lavoro/interesse reale)** | `sales_doctrine` | 8 | §4, §5, §6 | Affina la classificazione di `classify-email-response`. |
| 4 | **Follow-up sequence: 1ª, 2ª, 3ª email senza risposta** | `sales_doctrine` | 8 | §7 | Tono e contenuto per ogni step. Usato da `generate-outreach`. |
| 5 | **Funnemail – deep search e sintesi esecutiva (badge + 1-2 righe)** | `operative_procedures` | 9 | §10, §11 | Riallinea `content-intelligence` al formato badge richiesto. |
| 6 | **Procedura preventivo: arrivo → estrazione dati → preparazione → follow-up** | `operative_procedures` | 8 | §15 | Estende `operative/quote-response.md` con dati mancanti, urgenza, margine. |
| 7 | **Procedura problemi spedizione (ritardo, ritiro, consegna, tracking)** | `operative_procedures` | 8 | §16 | Estende `operative/tracking-updates.md`, `booking-management.md`. |
| 8 | **Procedura amministrativa: fatture, pagamenti, fiscale, legale** | `administrative_procedures` | 8 | §17 | Estende `administrative/*.md`. |
| 9 | **Stati job + presa in carico ("Lo prendo io")** | `procedures` | 7 | §20, §21, §22 | Riferimento per UI Reparti Kanban e per dispatcher. |

Note:
- Schede brevi (max 1500 char ognuna) per non gonfiare il contesto. Doctrine = principi; Procedure = step.
- Tutte attive (`is_active=true`), `source_path` puntato al documento per tracciabilità.
- Indicizzate via FTS italiano (`loadKbContext`) — pescate solo quando il prompt lo richiede.

---

## Parte B — 4 proposte di patch su prompt operativi esistenti

Tutte create in `prompt_change_proposals` (status=pending). Tu approvi una per una dal Prompt Copilot.

| # | Prompt target | Blocco | Patch proposta |
|---|---------------|--------|----------------|
| P1 | `Content Intelligence` (classify-inbound-content) | sezione "Output / Sintesi" | Imporre formato **badge + 1-2 righe esecutive** (es. "Preventivo urgente · Cliente chiede quotazione MXP→JFK 250kg"). Lista badge canonici da §11.2. |
| P2 | `Operative Dispatcher Routing` | sezione "Routing reparti" | Allineare 4 reparti al Kanban già esistente (commercial / operations / admin / general) e ai trigger §13-17 (preventivo→ops, fattura→admin, problema spedizione→ops, amministrativo→admin). |
| P3 | `Inbound Triage TMWE` | sezione "Quando emettere alert" | Aggiungere checklist §12.2 (preventivo reale, ritardo, tono irritato, valore economico) come segnali esplicit per `dispatch-urgent-alert`. Mantenere severity TMWE invariata. |
| P4 | `classify-email-response` | sezione "Categorie output" | Aggiungere distinzione §5.3 (**partner che cerca lavoro** vs **cliente interessato**) come categoria separata. Lead status guard resta sovrano. |

---

## Parte C — Già coperto (segnalo, non duplico)

- §8 Multicanale → `outreach-unified-system` + `multichannel-extension-architecture`.
- §10.2 Deep search mittente → `funnemail-scout-sender` + `partner-passport`.
- §12 Alert WhatsApp + escalation → `tmwe-inbound-triage-and-alerts` + `alert_recipients`/`alert_dispatch_log`.
- §14 Risposta automatica presa in carico → già possibile via `journalistReview` + dispatcher (resta opt-in, mai bypass review).
- §18 Quattro agende → **Kanban Reparti** approvato ieri.
- §19.2 Agenda storica → `agenda-action-grouping` (4 sezioni).
- §23 AI assistente → `Content Intelligence` step 2 + `ai_pending_actions`.

---

## Parte D — Backlog feature (NON tocco ora, segnalo)

Da affrontare con piani dedicati quando vorrai:

1. **Pulsante "Lo prendo io"** sul JobCard del Kanban Reparti (claim assignee + log timestamp).
2. **Area "Sorting"** separata da ToDo/Agenda per invii programmati e sequenze future (oggi mescolate in Agenda).
3. **Stati job estesi** (`in attesa cliente / fornitore / interno`, `in escalation`, `da riesaminare`) — richiede migration su `activities.status`.
4. **Reminder timer-based su job aperti** che escala a WA dopo soglia.

---

## Esecuzione (ordine, quando approvi)

1. Migration zero. Tutto via tabelle proposte già esistenti (`kb_entry_proposals`, `prompt_change_proposals`).
2. Inserisco le 9 proposte KB in batch (un'unica `INSERT`).
3. Inserisco le 4 proposte patch prompt in batch.
4. Ti consegno l'elenco con link/ID per revisione nel Prompt Reader.
5. Tu approvi/rifiuti dalla UI esistente — il sistema scrive su `kb_entries`/`operative_prompts` solo dopo la tua approvazione.

## Cosa NON faccio in questo piano
- Non modifico edge functions (`classify-inbound-content`, `classify-email-response`, dispatcher).
- Non tocco prompt direttamente.
- Non implemento le 4 feature di backlog.
- Non modifico la UI.

## Domanda finale prima di partire
Vuoi che includa anche le immagini estratte dalle 27 pagine (sono screenshot del docx, non utili come KB) o le ignoro? **Suggerisco di ignorarle** — la KB di Funnemail vive di testo searchable.
