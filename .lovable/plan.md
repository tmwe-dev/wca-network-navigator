## Obiettivo

Coprire in fasi tutte le aree emerse nella guida (pipeline generazione, classificazione inbound, holding pattern, dispatcher operativo, wake-up, gruppi mittenti) e — punto centrale — fare un **audit profondo dei prompt** che governano oggi l'AI, perché sono loro a decidere come catalogare, escalare e rispondere.

---

## Fase 0 — Audit prompt (priorità massima, prerequisito per tutto il resto)

Stato attuale rilevato:
- **37 prompt operativi** in `operative_prompts`, di cui **29 attivi unici** + **8 duplicati tripli** (tutti i `Command — *` esistono in 3 copie identiche → rumore nel context window e rischio di derive).
- **Solo 1 prompt** governa la classificazione inbound (`Email Domain Detection Rules`, priority 85).
- **Solo 1 prompt** governa la transizione di stato (`Lead Qualification v2 (9 stati)`).
- Il classificatore TS (`src/v2/agent/prompts/core/email-classifier.ts`) ha 7 categorie hardcoded ma **nessuna distinzione per gruppo mittente** (administrative, fornitori, partner, lead commerciale).
- `computeEscalation` in `src/lib/leadEscalation.ts` scatta su qualunque `interested+positive` → un "grazie per la fattura" può promuovere un fornitore a `engaged`.

Deliverable Fase 0:
1. **Report `/mnt/documents/prompt-audit.md`** con, per ogni prompt attivo:
   - copertura (quale edge/feature lo carica davvero, via grep su `loadOperativePrompts`),
   - sovrapposizioni e contraddizioni,
   - gap (es. nessun prompt per "amministrazione", "offerta", "supporto"),
   - score di efficacia 0-100 con motivazione,
   - azione consigliata (mantieni / fondi / riscrivi / deprecca).
2. **Pulizia duplicati Command** (8 deprecazioni soft via `deprecated_at`, una sola copia attiva per nome).
3. **Test di regressione** per i 5 prompt più critici (Lead Qualification, Email A→Z, WhatsApp Gate, Post-Send, Zero Allucinazioni) usando `prompt_test_cases` già esistente — fissano il comportamento atteso prima di toccare qualunque cosa.

Niente modifiche di codice in Fase 0 oltre alla pulizia DB e ai test case: **prima misuriamo, poi cambiamo**.

---

## Fase 1 — Group-aware classification (collega `email_address_rules.group_name` al classificatore)

Problema: oggi `classify-email-response` non sa se il mittente è "Amministrazione GitHub" o "Lead commerciale". Risultato: amministrative possono spostare lo stato lead.

Interventi:
- In `classify-inbound-message` / `classify-email-response`: prima di chiamare l'AI, leggere `email_address_rules` per `from_address` e iniettare nel prompt un blocco `SENDER GROUP: amministrazione | offerte | supporto | commerciale | sconosciuto`.
- Nuovo prompt operativo **`Group-Aware Classification`** (context=`classification`, priority 90) con regole esplicite: se gruppo ≠ commerciale → categoria forzata `unrelated` lato lead pipeline, ma categoria operativa specifica (es. `admin_invoice`, `quote_request`).
- `computeEscalation`: gate hard "se gruppo non è commerciale o sconosciuto, **non promuovere mai** lead_status".
- Test: 10 fixture email reali (3 admin, 3 offerte, 2 supporto, 2 commerciali) → snapshot della classificazione attesa.

---

## Fase 2 — Operative dispatcher (azioni automatiche per gruppo non-commerciale)

Oggi un'email del gruppo "Amministrazione" o "Offerte" finisce in inbox e basta.

Interventi:
- Nuova tabella `inbound_operative_actions` (group, category, action_type, default_assignee, sla_hours).
- Edge `dispatch-inbound-action` chiamata da `classify-inbound-message` quando `category` ∈ {`admin_invoice`, `quote_request`, `support_ticket`, ...}: crea `activity` con tipo dedicato, scadenza basata su SLA, assegnata al ruolo giusto.
- UI: tab "Operative" in `/v2/inbox` raggruppa queste activity per gruppo mittente.
- Prompt operativo nuovo: **`Operative Dispatcher Routing`** (criteri di assegnazione, priorità, esempi).

---

## Fase 3 — Holding pattern intelligente (downgrade + risveglio)

Oggi `smart-scheduler` e `cadence-engine` esistono ma le soglie sono in codice.

Interventi:
- Tabella `wake_up_rules` (group_name nullable, min_score, days_dormant, channel, max_per_day) editabile da UI Funny Mail.
- `smart-scheduler` legge le regole invece delle costanti.
- Prompt operativo **`Wake-Up Composer`** che genera il messaggio di risveglio variando tono in base a `days_dormant` e ultimo canale toccato (anti-ripetizione già coperto da `Anti-Ripetizione Multi-Touch`).
- UI in Funny Mail: tab "Risvegli" con preview delle prossime 50 esecuzioni schedulate.

---

## Fase 4 — Pipeline outreach: verifica contratto unico

Verifica (non riscrittura) che **tutti** i punti di generazione passino dalla pipeline canonica:
- `generate-email`, `generate-outreach`, `improve-email`, `agent-execute` (modalità compose), wake-up di Fase 3.
- Tutti devono caricare gli stessi prompt OBBLIGATORI (`Email Single A→Z`, `Zero Allucinazioni`, `Post-Send Checklist`, `WhatsApp Message Gate` per WA) e passare per `journalistReview`.
- Output: report `/mnt/documents/pipeline-coverage.md` con matrice "edge × prompt obbligatorio × journalist review".
- Fix mirati solo dove la matrice mostra gap (no refactor opportunistico — workspace rule).

---

## Fase 5 — UI Funny Mail: editor prompt per gruppo

Oggi i `custom_prompt` per address esistono (Fase precedente), ma per **gruppo** no.

Interventi:
- Estendere `email_sender_groups` con campi `classification_hint`, `response_style_hint`, `auto_action_default`.
- UI: per ogni gruppo, editor a 3 campi (cosa è questo gruppo / come classificarlo / come rispondere).
- Iniezione automatica di questi hint nel prompt di classificazione e di risposta quando il mittente appartiene al gruppo.

---

## Fase 6 — Osservabilità prompt e loop di apprendimento

- Dashboard `/v2/prompt-lab/effectiveness`: per ogni prompt attivo mostra ultime 100 esecuzioni (da `ai_interaction_log` + `prompt_test_runs`), tasso di successo, tempo medio, feedback 👍/👎.
- Alert Discord se un prompt scende sotto 70% di successo per 24h.
- Pulsante "Genera nuova versione" che chiama `agent-prompt-refiner` con i fallimenti come contesto, salva snapshot in `prompt_versions` e apre un test A/B prima della promozione.

---

## Note tecniche (non per l'utente finale)

- Niente modifiche a `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (memoria vincolante).
- Tutte le promozioni di stato lead continuano a passare da `applyLeadStatusChange` (Lead Status Guard Protocol).
- Tutte le invocazioni AI restano dentro `invokeAi` con `scope` registrato (AI Invocation Charter).
- Soft-delete globale rispettato: nessun DELETE su `operative_prompts`, solo `deprecated_at`.
- Ogni nuovo prompt segue lo standard a 5 sezioni (`docs/prompt-standard.md`).

---

## Domanda prima di partire

Vuoi che parta **subito da Fase 0** (audit + pulizia duplicati + test di regressione) producendo il report `/mnt/documents/prompt-audit.md`, oppure preferisci che salti l'audit e attacchi direttamente Fase 1 (group-aware classification, l'impatto pratico più visibile)?

---

## Stato implementazione (2026-05-04)

- ✅ **Fase 0** — audit + deprecazione 8 duplicati Command (`/mnt/documents/prompt-audit.md`).
- ✅ **Fase 1** — `classify-email-response` ora: (a) join `email_sender_groups`, (b) blocco `SENDER GROUP` iniettato nel prompt, (c) `getNextStatusGated` impedisce promozione lead se gruppo non commerciale. Nuovo prompt `Group-Aware Classification` (priority 90).
- ✅ **Fase 2 (DB)** — tabella `inbound_operative_actions` + prompt `Operative Dispatcher Routing`. Edge `dispatch-inbound-action` da implementare quando l'utente configura le prime regole via UI.
- ✅ **Fase 3 (DB)** — tabella `wake_up_rules` + prompt `Wake-Up Composer`. Wiring di `smart-scheduler` resta da fare quando ci sono righe configurate.
- ✅ **Fase 4** — coverage report generato (`/mnt/documents/pipeline-coverage.md`).
- ✅ **Fase 5** — campi `classification_hint`, `response_style_hint`, `auto_action_default` aggiunti a `email_sender_groups`. UI editor da aggiungere quando l'utente vuole gestirli visualmente in Funny Mail.
- ⏸ **Fase 6** — dashboard effectiveness rinviata: già esistono `ai_interaction_log` e `prompt_test_runs`; la pagina `/v2/prompt-lab/effectiveness` può essere costruita on-demand.
