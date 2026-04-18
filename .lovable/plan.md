

## Fase 3 — Generatori guidati da Dottrina

### Stato verificato
- **Fix 3.1**: `index.ts:154` calcola `relationship_stage` da `interactionHistoryCount` (cold/warming/active). Ma `contextAssembler.ts:208` chiama già `analyzeRelationshipHistory()` che ritorna `metrics.relationship_stage` (cold/warm/active/stale/ghosted) — solo che `metrics` non viene esposto fuori. Doppia verità.
- **Fix 3.2**: Nessun riferimento a `commercial_playbooks` o `partner_workflow_state` in `generate-outreach/contextAssembler.ts` né in `generate-email`. Confermato: playbook NON inietta nei generatori.
- **Schema reale**: `partner_workflow_state` ha `workflow_id` (FK NOT NULL → `commercial_workflows.id`), NO `active_playbook_code`. Per recuperare il playbook attivo serve join: `partner_workflow_state` → `commercial_workflows.code` → `commercial_playbooks.workflow_code` (prendendo il più prioritario).
- **Fix 3.3**: Nessuna dichiarazione di canale onesta nel context outreach.
- **Fix 3.4**: `cadence-engine/index.ts:434-445` `scheduleNextStep` non porta context strategico nel metadata.

### Modifiche

| # | File | Modifica |
|---|------|----------|
| 3.1 | `supabase/functions/generate-outreach/contextAssembler.ts` | Aggiungo `relationshipStage` e `relationshipMetrics` al return type. In `analyzeRelationshipHistory`, espongo `metrics.relationship_stage`, `metrics.unanswered_count`, `metrics.days_since_last_contact`, `metrics.commercial_state` |
| 3.1 | `supabase/functions/generate-outreach/index.ts` | `decision.relationship_stage = ctx.relationshipStage` (single source). Aggiungo `decision.relationship_detail` con metriche reali. Aggiorno anche `cta_type`, `email_type` e `forbidden_elements` per usare lo stage reale (cold/warm/active/stale/ghosted) anziché il count |
| 3.2 | `supabase/functions/generate-outreach/contextAssembler.ts` | Loader `loadActivePlaybook(supabase, userId, partnerId)`: se esiste `partner_workflow_state` con `status='active'`, join via `workflow_id` → `commercial_workflows.code` → cerca `commercial_playbooks` con `workflow_code` matching e `is_active=true` (priorità desc, prendi primo). Restituisco `playbookContext` text block. Aggiungo `playbookBlock` al return |
| 3.2 | `supabase/functions/generate-outreach/promptBuilder.ts` | Inserisco `playbookBlock` nel system prompt come sezione "PLAYBOOK ATTIVO" (sopra gli altri context block) |
| 3.2 | `supabase/functions/generate-email/contextAssembler.ts` | Stesso loader playbook + aggiungo `playbookBlock` a `ContextBlocks` |
| 3.2 | `supabase/functions/generate-email/promptBuilder.ts` | Iniezione `playbookBlock` nel system prompt |
| 3.3 | `supabase/functions/generate-outreach/contextAssembler.ts` | Aggiungo `channelDeclaration` al return: email = "contesto storico completo", whatsapp/linkedin = "contesto limitato, tono breve" |
| 3.3 | `supabase/functions/generate-outreach/promptBuilder.ts` | Iniezione `channelDeclaration` come prima riga del system prompt |
| 3.4 | `supabase/functions/cadence-engine/index.ts:434-445` | `scheduleNextStep`: arricchisco `metadata.cadence_context` con `previous_channel`, `previous_step`, `sequence_position`, `escalation_reason` |

### Ordine
3.4 (autocontenuto) → 3.1 (contextAssembler + index) → 3.3 (declaration aggiungibile in stesso pass su contextAssembler) → 3.2 (playbook loader, doppio file)

### Deploy
Edge functions: `generate-outreach`, `generate-email`, `cadence-engine`.

### Verifica
- Grep `relationship_stage` in `generate-outreach/index.ts` → una sola sorgente (da `ctx`)
- Grep `loadActivePlaybook` → presente in entrambi i contextAssembler
- Grep `cadence_context` → presente in `scheduleNextStep`
- Smoke test:
  - Partner con `partner_workflow_state` attivo + workflow con playbook → log debug `_debug.playbook_active=true`
  - Partner con 5 sent / 0 received → `decision_object.relationship_stage="ghosted"`
  - Generate outreach WhatsApp → prompt contiene "contesto storico limitato"

### Fuori scope
- Aggiungere colonna `active_playbook_code` a `partner_workflow_state` (qui si usa join via workflow_code, sufficiente)
- UI per attivare playbook manualmente
- Test E2E

