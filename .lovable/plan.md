# Piano CORRETTO — Audit ✅, niente duplicati

Hai ragione: il sistema prompt-per-indirizzo **esiste già ed è cablato ovunque**. Cancello la proposta sbagliata. Audit completo qui sotto.

---

## AUDIT — Cosa esiste già (NON toccare)

### Tabella `email_address_rules` (47 colonne)
Già presenti:
- `custom_prompt` (text) — istruzione libera, **massima priorità**
- `prompt_id` (uuid) → FK a `email_prompts.id` — prompt riusabile
- `tone_override` (text) — tono dedicato
- `topics_to_emphasize` / `topics_to_avoid` (array)
- `category`, `group_name`, `group_id`, `group_color`, `group_icon`
- `auto_action`, `auto_action_params`, `auto_execute`, `ai_confidence_threshold`
- `preferred_channel`, `exclusive_agent_id`
- `priority`, `is_active`, `is_blocked`
- AI suggestion: `ai_suggested_group`, `ai_suggestion_confidence`, `ai_suggestion_accepted`
- Telemetria: `interaction_count`, `success_rate`, `last_interaction_at`, `applied_count`

### Tabella `email_prompts`
`scope`, `scope_value`, `title`, `instructions`, `priority`, `is_active` — prompt riusabili globali/per scope.

### Iniezione già attiva (in ordine di priorità)
1. **`custom_prompt`** → "ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO"
2. **`email_prompts.instructions`** (via `prompt_id`) → "SENDER PROMPT"
3. `tone_override` + `topics_*`
4. `email_sender_groups` (nome_gruppo, classification_hint, response_style_hint)

Cablato in:
- `classify-email-response/classificationPrompts.ts` (linee 34-36)
- `classify-email-response/index.ts` (join `email_prompts:prompt_id` + `email_sender_groups:group_id`, linea 117)
- `generate-email/contextAssembler.ts` (linea 194)
- `generate-email/conversationIntel.ts` (linee 60-62, 139-141)
- `generate-outreach/conversationContext.ts` (linee 28-76)

### UI già esistente
- `EmailIntelligencePage` (pagina Funny Mail)
- `prompt-lab/tabs/EmailPromptsTab` (editor `email_prompts`)
- `InlineGroupAssigner` (assegnazione gruppo da inbox)
- DAL: `emailAddressRules.ts` (`upsertEmailAddressRule`, bulk actions), `emailPrompts.ts`

### Funzioni edge correlate
`apply-email-rules`, `backfill-email-rules`, `suggest-email-groups`, `classify-inbound-message`, `classify-email-response`, `inbound-dispatcher`, `cadence-engine`

### Tabelle pipeline già introdotte (Fase 1 sessione precedente)
`inbound_operative_actions`, `wake_up_rules`, `email_sender_groups.classification_hint/response_style_hint/auto_action_default`

---

## PIANO RIVISTO (3 fasi pulite, zero duplicati schema)

### FASE 1 — Agenda mail-first (UX)
Solo frontend, zero schema. Tutto quello che ti serve è già nel DB.

**1.1 Badge sulla card e nel pannello.** Mostriamo `group_name` (con `group_color`/`group_icon`), `category`, e — se l'inbound è già stato classificato — la categoria AI (`inbound_messages.classification` o `intent`). Hook esistente: `useEmailAddressGroups.getGroup(email)`.

**1.2 Anteprima messaggio inline nel pannello destro.** Sezione "Messaggio ricevuto": mittente, oggetto, snippet 4-6 righe del body, "Mostra tutto" espande inline. Letto da `inbound_messages` correlato all'attività.

**1.3 Azioni inline:** Aggiungi nota, Marca gestita, Archivia, **Rispondi inline** (mini composer che chiama la pipeline `send-email` esistente — niente modifiche IMAP). Sync stato già garantito da `increment_partner_interaction`.

**1.4 Mittente sconosciuto:** pulsanti "Crea partner da dominio", "Ignora dominio" (`auto_action='ignore'` su `email_address_rules`), "Avvia Scout".

### FASE 2 — Funny Mail come centro di controllo (UX + 1 prompt)
Niente nuovo schema.

**2.1 Vista 3 colonne in `EmailIntelligencePage`:** feed inbound ordinato per priorità commerciale | mail selezionata + thread | "Cosa farebbe l'AI" (classificazione, prompt usato, azioni proposte).

**2.2 Priorità commerciale** (alto valore = soldi):
- Calcolata in lettura, da `inbound_messages.classification` + categoria mittente.
- High: `quote_request`, `account_opening`, `customer_reply_active`.
- Medium: `complaint`, `info_request`.
- Bassa: `notification_system`, `newsletter`.
- Implementazione: helper TS in `src/v2/lib/`, no colonna nuova.

**2.3 Trasparenza prompt:** nel pannello "Cosa farebbe l'AI", mostriamo quale prompt è stato applicato (`custom_prompt` / `email_prompts.title` / `group_name`). Lettura sola.

**2.4 Editor inline:** dalla mail selezionata, pulsante "Modifica regole indirizzo" apre drawer con `custom_prompt`, `prompt_id` (dropdown da `email_prompts`), `tone_override`, `topics_*`, `auto_action`. **Riusa** `upsertEmailAddressRule` già esistente.

### FASE 3 — Deep Search L1 Scout come arricchimento di base
**3.1** Edge `inbound-scout-trigger`: mail da dominio sconosciuto → enqueue Scout su `ai_pending_actions` (rate-limit 1/24h per dominio).

**3.2** Pulsante "Arricchisci ora" su WCA grid + card partner.

**3.3** Auto-Scout su insert partner/contact/business_card (trigger DB → enqueue).

**3.4** Pulizia dead code: rimuovi `useDeepSearchExtraSources`, `useDeepSearchHelpers`, `DeepSearchSection`. Slim `useDeepSearchLocal`.

### FASE 4 — Test regressione prompt (continuo)
- Test cases per `Group-Aware Classification`, `Operative Dispatcher Routing`, `Wake-Up Composer` via `prompt-test-runner` esistente.

---

## Cosa CAMBIA rispetto al piano precedente

| Prima (sbagliato) | Adesso |
|---|---|
| ❌ Aggiungere `custom_prompt` su `email_sender_rules` | ✅ Già esiste su `email_address_rules` |
| ❌ Nuova tabella `address_prompts` | ✅ Già esiste `email_prompts` + FK `prompt_id` |
| ❌ Cablare iniezione in classify/generate | ✅ Già cablato in 5 file edge |
| ❌ Nuova UI editor prompt indirizzo | ✅ Estendere `EmailIntelligencePage` con drawer su rule esistente |
| ❌ Nuovo campo `revenue_impact` | ✅ Helper TS derivato in lettura |

Nessun nuovo schema, nessuna duplicazione. Confermi e parto dalla Fase 1?
