## Obiettivo

1. **Archiviare** in modo persistente l'audit del 4 maggio 2026 ("Audit AI Routing 2026-05-04") nel repository e nella memoria di progetto, così resta consultabile e citabile.
2. **Produrre un audit di seconda generazione**, più profondo e strutturato, che attraversi sei livelli in sequenza e che alla fine confronti le sue conclusioni con quelle del primo audit (conferme, smentite, novità).

Nessuna modifica al codice. Solo lettura, query DB, scrittura di documenti in `docs/audit/` e `/mnt/documents/`.

---

## Fase 1 — Registrazione dell'audit precedente

- Copiare `/mnt/documents/audit-ai-routing-2026-05-04.md` in `docs/audit/2026-05-04-ai-routing.md` (versione canonica nel repo, tracciata da git).
- Aggiungere una riga in `docs/audit/README.md` (creandolo se manca) come indice cronologico degli audit.
- Aggiungere una memoria `mem://reference/ai-routing-audit-2026-05-04` con un riassunto dei 3 P0 e dei 4 P1 individuati e un puntatore al file.

---

## Fase 2 — Audit profondo a 6 livelli

Ogni livello produce una sezione del report finale, con: **inventario**, **flusso**, **rischi**, **evidenze quantitative dal DB**, **delta rispetto all'audit precedente**.

### Livello 1 — Architettura

- Disegno completo del sistema commerciale autonomo: ingresso (IMAP, scraping, BCA, import), governance (Charter, Risk Gate, Editorial Review), esecuzione (edge functions, cron), osservabilità (`ai_interaction_log`, `edge_metrics`, supervisor_audit_log).
- Confini fra: V2 UI → hooks → DAL → edge functions → modelli AI → DB.
- Mappa "chi parla con chi" tra i 113 edge functions, raggruppati per dominio (inbox, classificazione, generazione, esecuzione, scheduling, governance, learning).
- Mappa ASCII del flusso end-to-end e tabella dei nodi critici secondo il principio madre.

### Livello 2 — Moduli

Per ciascun macro-modulo, inventario dei file principali, responsabilità dichiarata vs reale, dipendenze e debiti:

- **Inbox & ingestion**: `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `apply-email-rules`.
- **Classificazione**: `classify-email-response`, `classify-inbound-message`, `funnemail-classify`, `reply-classifier` (sovrapposizione già segnalata, da quantificare con statistiche di chiamata).
- **Routing post-classificazione**: `EmailProcessManager`, `postClassificationPipeline`, `emailRouter`, `domainHandler`, `bounceAndUnsubscribeHandler`, `questionAndComplaintHandler`.
- **Generazione**: `generate-email`, `generate-outreach`, `improve-email`, `journalistReview`.
- **Esecuzione**: `pending-action-executor`, `aiActionRiskGate`, `confirm-injection-review`.
- **Scheduling**: `cadence-engine`, `outreach-scheduler`, `smart-scheduler`, `agent-autonomous-cycle`, `reminderManager`.
- **Governance & sicurezza**: `aiInvocationGuard`, `promptSanitizer`, `injectionGuard`, `_shared/cors.ts`, `securityHeaders`.
- **Apprendimento**: `email_classifications` learning loop, `aiEditPatterns`, prompt versioning + test runner.

### Livello 3 — Funzioni

Per i nodi critici di ciascun modulo: firma, input/output reali, side effects, idempotenza, gestione errori, timeout, retry, logging strutturato. Verifica puntuale dei bug del primo audit:

- `postProcessing.ts:64` filtro `raw_payload.direction` (P0 confermato?).
- `funnemail-classify` mai cablato: dove andrebbe innestato e con quale contratto.
- `generateReplyDraft` in `classificationRules.ts`: bypass del journalist review e bug del payload (funzione passata invece di oggetto).
- 17 categorie AI senza handler in `postClassificationPipeline`: lista esaustiva con la categoria DB e l'azione attesa.
- `pending-action-executor`: handler mancanti (`reply_to_question`, `handle_complaint`, ecc.).

### Livello 4 — Matching

Come il sistema riconcilia entità:

- **Email → contatto**: dedup, alias, normalizzazione mittente, pattern matching per `email_address_rules`.
- **Risposta → thread/lead**: chiavi (`In-Reply-To`, `References`, `partner_id`, `contact_id`), campi della tabella `channel_messages`, casi di mismatch.
- **WA / LinkedIn → contatto**: `phone_normalize`, `linkedin_url`, fallback su nome+azienda.
- **Categoria AI → handler**: tabella che incrocia le categorie prodotte dai classifier con le branch del router; evidenzia i buchi.
- **Operative prompt → contesto**: come `operativePromptsLoader` filtra per `context` + tag.
- **KB → agente**: politiche di filtro KB per persona (sezione 6).

### Livello 5 — Sincronizzazione

Concorrenza, ordini di operazioni, race condition:

- **Cron vs cron**: i 19 cron jobs, frequenza, cosa scrivono. Identificare possibili reminder duplicati fra `cadence-engine`, `outreach-scheduler`, `smart-scheduler`, `agent-autonomous-cycle`.
- **Idempotenza**: code outreach, queue email, `cockpit_queue`, `outreach_queue`, `campaign_jobs`.
- **Two-phase commit del Risk Gate**: verifica del flusso pending → approved → executed e dei casi di stallo.
- **Backfill cursors WA/LI**: `channel_backfill_state`, integrità dei cursori.
- **Soft-delete trigger**: copertura sulle 15 tabelle business; verifica che tutte le DELETE applicative siano effettivamente intercettate.
- **Realtime / invalidation**: invalidazione query keys lato UI dopo mutazioni AI.

### Livello 6 — Agenti, prompt, knowledge base

L'analisi più dettagliata, oggi quantificabile come:

- **14 agenti attivi**, **45 capabilities**, **0 personas DB** (gap rispetto alla memoria che le dichiara), **50 operative_prompts**, **275 KB entries**, **25 voci `ai_scope_registry`**, **0 `agent_routing_rules`**.

Per ogni agente attivo:
- Ruolo, persona effettiva (DB vs prompt), tools whitelist, modello, modalità (loop vs single-shot).
- Prompt operativi assegnati per `context` e tag, versioni in `prompt_versions`, presenza di test in `prompt_test_cases`.
- KB a cui ha accesso: categorie filtrate, copertura della doctrine, duplicati noti dal "KB Doctrine Audit 2026-05-02".
- Scope AI dichiarato in `ai_scope_registry` vs scope effettivamente invocati dal frontend (analisi su `ai_interaction_log` se popolato).
- Editorial review: per gli agenti che producono email/WA/LI, conferma della rotta obbligatoria via `journalistReview`.

### Confronto con l'audit del 4 maggio

Tabella finale a tre colonne — **Finding precedente**, **Stato oggi (verificato)**, **Note / nuovi rischi**. Marca:
- ✅ confermato e ancora aperto
- 🟢 confermato e già risolto
- 🟡 parzialmente vero / da correggere
- ➕ nuovo rischio non visto la prima volta

---

## Output

- `docs/audit/2026-05-04-ai-routing.md` — copia tracciata del primo audit.
- `docs/audit/README.md` — indice degli audit.
- `docs/audit/2026-05-04-deep-ai-audit.md` — nuovo audit profondo (6 sezioni + confronto).
- `/mnt/documents/audit-ai-deep-2026-05-04.md` — copia consultabile dall'utente, con `<lov-artifact>` allegato in chat.
- Memoria `mem://reference/ai-routing-audit-2026-05-04` aggiunta.

## Cosa NON faccio in questo task

- Nessuna modifica al codice o alle migrations.
- Nessun fix dei P0/P1: l'output è solo il report, da cui poi deciderai cosa attaccare.
- Nessuna modifica ai cron o agli edge functions.

## Stima tempi

Audit profondo + scrittura: ~15–25 minuti reali, con molte query DB e letture di edge functions. Posso procedere appena approvi.
