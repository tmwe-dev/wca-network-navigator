## Audit (cosa esiste già — NON tocchiamo)

**Pagina** `/v2/email-intelligence` esiste con titolo **"Funnemail"** e 4 tab: Manuale, Suggerimenti AI, Auto-Classificazione, Regole.

**Pipeline inbound funzionante:**
- Trigger DB → `classify-inbound-message` (anti-injection guard, normalizzazione contenuto, classificazione LLM via Lovable AI Gateway, scrive `reply_classifications`, aggiorna `activities`).
- Chiama `EmailProcessManager.processClassification()` → `LeadProcessManager` (eventi → lead_status, pipeline, tasks).
- Per email reply specifiche c'è `classify-email-response` (Lead Qualification v2).
- `apply-email-rules` + `backfill-email-rules` eseguono `auto_action` IMAP (mark_read, archive, move_to_folder, spam).

**Coda di invio:** `process-email-queue` (pgmq, 5s, retry, DLQ, TTL) + `email_send_log`. **Intoccabile.**

**Editorial review:** `journalistReview` obbligatorio su ogni email/WA/LI generata. **Intoccabile.**

**Schema rilevante già pronto:**
- `email_sender_groups`: 30+ gruppi (Operativo, Commerciale, Spam, Partners, NO_REPLY, WCA…) con campi `auto_action`, `auto_action_params`, `classification_hint`, `response_style_hint`, `auto_action_default` — oggi `auto_action='none'` su tutti.
- `email_address_rules`: ha già `auto_action`, `auto_execute`, `ai_confidence_threshold`, `group_id`.

**Manca:** persona "Funnemail" in `agents`, mappa "gruppo → cosa fa AI all'arrivo", UI per configurarla, hook nel flusso inbound che la consulti.

## Cosa NON facciamo (vincoli rispettati)

- Nessun nuovo edge orchestratore parallelo a `classify-inbound-message`.
- Non duplichiamo la classificazione, non bypassiamo `journalistReview`, non scriviamo direttamente in `email_send_log`.
- Non tocchiamo `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `process-email-queue`.
- Le bozze prodotte da Funnemail entrano in `email_drafts` (coda di approvazione esistente). Mai invio diretto.
- L'archive/spam IMAP continua a passare da `apply-email-rules` (motore esistente).

## Architettura proposta

```text
mail in → classify-inbound-message  (resta com'è)
            │
            ├─ reply_classifications  (resta)
            ├─ EmailProcessManager   (resta — eventi lead/pipeline)
            │
            └─→ NUOVO: funnemailPolicyDispatcher (modulo _shared, NON edge)
                  ├─ legge group del mittente (email_address_rules.group_id → email_sender_groups)
                  ├─ legge funnemail_policy del gruppo (nuova colonna jsonb su email_sender_groups)
                  ├─ rispetta confidence threshold + hard guards esistenti
                  └─ esegue azioni dichiarative:
                       • tag_only          → solo classifica/log (default rumore)
                       • deep_search       → invoca sherlock-extract scout SE partner unknown o enrichment > N gg
                       • draft_reply       → genera bozza via flusso esistente (generate-email + journalistReview) → email_drafts
                       • crm_update        → applyLeadStatusChange + task Agenda (delega a leadProcessManager)
                       • imap_action       → delega a apply-email-rules (archive/move/mark)
                  → log in funnemail_actions_log (audit, idempotente per message_id+action)
```

Persona "Funnemail" registrata in `agents` (per firma, system_prompt, tono coerente nelle bozze). `agent_id` usato solo come metadato/owner delle bozze e per il filtro di prompt operativi (loader esistente). Nessun cambio di routing degli agent personas.

## Step (ordine)

### Step 1 — Persona "Funnemail" in `agents` (DB only)
Insert riga in `agents` (name="Funnemail", role="inbox_curator", avatar_emoji="📧", system_prompt minimale che richiama Standard Professore). Nessuna UI nuova.

### Step 2 — Schema policy per gruppo
Migrazione: aggiungere `funnemail_policy jsonb default '{}'` a `email_sender_groups`. Forma:
```json
{
  "enabled": true,
  "actions": ["tag_only","deep_search","draft_reply","crm_update","imap_action"],
  "deep_search": { "trigger": "if_unknown_or_stale", "stale_days": 30, "level": "scout" },
  "draft_reply": { "tone": "neutral_b2b", "agent_id": "<funnemail-uuid>" },
  "crm_update":  { "set_lead_status": null, "create_task": false },
  "imap_action": { "type": "none" },
  "min_confidence": 0.6
}
```
Nuova tabella `funnemail_actions_log (id, message_id, group_id, action, status, payload jsonb, error, created_at)` — RLS "operatori autenticati select"; insert via service role.

### Step 3 — Modulo `_shared/funnemailDispatcher.ts`
Funzione pura `dispatch({ supabase, classification, fromAddress, partnerId, userId, channel, messageId, subject, normalizedBody })`:
- carica gruppo via `email_address_rules` (sender o domain match) + `email_sender_groups.funnemail_policy`.
- se `enabled=false` o channel ≠ "email" → no-op (Funnemail = SOLO email).
- per ogni azione abilitata: chiama il flusso esistente, idempotente su `funnemail_actions_log(message_id, action)`.
- mai invio diretto, mai bypass di `journalistReview`.

### Step 4 — Hook in `classify-inbound-message`
Una sola chiamata aggiuntiva DOPO `EmailProcessManager.processClassification()`, dentro try/catch che NON rompe il return. Solo se `channel === "email"`.

### Step 5 — UI: nuovo tab "Funnemail" nella pagina `/v2/email-intelligence`
Quinto tab "Funnemail" (dopo "Regole & Azioni") con:
- tabella gruppi con colonne: nome, enabled, azioni attive (chip), min_confidence, ultima esecuzione.
- editor policy per gruppo (dialog) con switch per ogni azione + parametri.
- tail "Ultime azioni Funnemail" da `funnemail_actions_log` (status colorati, link al messaggio).

Nessuna modifica agli altri 4 tab. Header pagina "Funnemail" già esistente.

### Step 6 — Verifica
- `supabase--test_edge_functions` su `classify-inbound-message`.
- Smoke manuale: 1 email da gruppo "Spam" → solo tag + imap_action archive (via apply-email-rules), NIENTE bozza.
- 1 email da gruppo "Partners" con partner senza enrichment → deep_search scout + draft_reply in `email_drafts`, NIENTE invio.
- Verifica `funnemail_actions_log` popolato e idempotente al replay.

## Dettagli tecnici

- Funnemail **solo email**: il dispatcher esce subito su WA/LI per non interferire con bridge protocol.
- `min_confidence`: se `reply_classifications.confidence < soglia` → solo `tag_only`, mai bozze/CRM.
- Hard guards AI esistenti restano attivi (no DELETE, bulk cap, injection guard già davanti).
- `auto_action` esistente sui gruppi NON viene rimosso: resta fonte per `apply-email-rules` IMAP. La policy nuova è additiva e dichiarativa per le azioni AI.
- Idempotenza: unique index su `funnemail_actions_log(message_id, action)`.
- Loop bozze: il `draft_reply` riusa `generate-email` (che già passa da `journalistReview` e `loadOperativePrompts`).

## Cosa resta fuori (proposte future, non in questo piano)

- Auto-send anche per categorie tipiche (bounce/no-reply): per ora SOLO bozza in coda.
- Estensione Funnemail a WA/LI (oggi out of scope).
- Dashboard KPI Funnemail (azioni/giorno, % accept-rate bozze): dopo aver raccolto dati nel log.
