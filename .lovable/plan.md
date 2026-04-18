

L'utente ha fornito un piano di bonifica già molto dettagliato (Fase 1 di 4 fasi). Devo verificare lo stato attuale del codice prima di confermare il piano, perché alcune diagnosi vanno validate sul codice reale.

Verifico i file chiave menzionati nei 9 fix.
<lov-tool-use id="toolu_vrtx_018VVVWDHC6jJtdboVTQHjYq" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/_shared\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017147AyeKTxbLJjqZ6F3tV3" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/ai-assistant\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TW24P4BnuGmCgML3jRXRn7" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/cadence-engine\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DL8hbveFzKEjLoajHJf63B" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/toolHandlersEnterprise.ts\", \"lines\": \"130-260\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01ETnSvA8DwFV6kSQzmNu1Vu" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/cadence-engine/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NropwcUebUqezBcgh78x86" name="code--view" integration-id="code" data="{\"file_path\": \"src/v2/hooks/useEmailComposerV2.ts\", \"lines\": \"100-130\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012s3ABnHee47KCbdR7qDCmb" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/toolHandlersEnterprise.ts\", \"lines\": \"280-354\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019rpKRB8i9n4GUDaGtjux8x" name="code--search_files" integration-id="code" data="{\"query\": \"executeApplyPlaybook|executeExecutePlanStep\", \"search_dir\": \"supabase/functions/_shared\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01MMqerjREyDG3P1yqbuBoqY" name="code--search_files" integration-id="code" data="{\"query\": \"scopeConfigs\", \"search_dir\": \"supabase/functions\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JWV8z8uMn4uaGpWBxzzf14" name="code--search_files" integration-id="code" data="{\"query\": \"tool-decision|provider\\\\.baseUrl|consumeCredits\", \"search_dir\": \"supabase/functions/ai-assistant\"}">
</lov-tool-use>
Buone notizie: Fix 1.7 (provider.baseUrl, consumeCredits con number) e Fix 1.9 (scope routing) sono già implementati. Verifico lo stato dei vari fix.
<lov-tool-use id="toolu_vrtx_011AKRfoTueZfTB2PxK1oAbH" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/toolHandlersEnterprise.ts\", \"lines\": \"75-130\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Qr3nQkmfA5NsayK8RZCXWz" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/ai-assistant/index.ts\", \"lines\": \"125-200\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JhLo9SvDVQeY5zAmhrzx4r" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/ai-assistant/index.ts\", \"lines\": \"490-540\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01GEo58Qg1fZeezbUS8heEbv" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='partner_workflow_state';\"}">
</lov-tool-use>
Stato verificato:
- **Fix 1.7** già applicato (`provider.url`, usage object)
- **Fix 1.9** già applicato (scope routing con scopeConfigs)
- **Tabella `partner_workflow_state`** esiste già (con colonne `current_gate`, `workflow_id`, etc — ma non ha `active_playbook_code`)

Verifico schema della tabella e il file scopeConfigs per capire quali tool ha "strategic":
<lov-tool-use id="toolu_vrtx_01Ah9dxXChWDQrAYudPt5nYC" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_workflow_state' ORDER BY ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BDCNXZRFmG3YGdLZHneH7T" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/scopeConfigs.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LCprPN9pKfC8u2vQtbyo9b" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='interactions' ORDER BY ordinal_position;\"}">
</lov-tool-use>
Ho tutto. Stato completo:

- **Fix 1.7** (provider.url, consumeCredits) → ✅ già fatto
- **Fix 1.9** (scope routing con scopeConfigs) → ✅ già fatto
- **Tabella `partner_workflow_state`** esiste, ma usa `workflow_id` (FK, NOT NULL) e ha `current_gate`, NON ha `active_playbook_code` né campo per playbook → la versione del prompt va adattata allo schema reale.

Presento il piano consolidato.

<lov-plan>

## Fase 1 — Bonifica AI: stato e piano applicativo

### Diagnosi rispetto al prompt originale

Tre fix sono **già applicati nel codice** e li escludo:
- **Fix 1.7** (`provider.url`, `consumeCredits` con oggetto usage): già presente in `ai-assistant/index.ts` linee 156, 188, 263, 778, 801.
- **Fix 1.9** (scope routing con `scopeConfigs`): già implementato a linee 514-528.
- **`scope=strategic` senza tool**: già configurato (`tools: []` in `scopeConfigs.ts` riga 302).

### Vincolo schema reale

La tabella `partner_workflow_state` esiste ma ha schema diverso dal prompt:
- ha `workflow_id` (FK NOT NULL a `commercial_workflows`), `current_gate`, `status`, `started_at`, `notes`
- NON ha `active_playbook_code` né colonne libere per il playbook
- ha vincolo NOT NULL su `workflow_id` → upsert diretto col solo playbook_code fallirebbe

Per **Fix 1.3** quindi NON aggiungo colonne (rispetto la dottrina "no schema bypass"). Risolvo l'attivazione playbook scrivendo nella tabella `interactions` (campo `notes` + `subject`) come audit trail tracciabile, e aggiungo metadata nella `ai_decision_log`. Ho anche verificato che `interactions` ha le colonne `partner_id`, `interaction_type`, `subject`, `notes`, `user_id`, `operator_id`, `interaction_date`.

### Fix da applicare

| # | File | Modifica |
|---|------|----------|
| 1.1 | `supabase/functions/_shared/toolHandlersEnterprise.ts` | `executeSearchKb`: aggiungo guard `if (!_userId) return { error: ... }` |
| 1.2 | `supabase/functions/_shared/toolHandlersEnterprise.ts` | `executeExecutePlanStep`: invece della nota fittizia, lookup tool nella mappa `toolExecutors` e esecuzione reale con try/catch. Definisco la mappa subito prima del `return`. |
| 1.3 | `supabase/functions/_shared/toolHandlersEnterprise.ts` | `executeApplyPlaybook`: se `args.partner_id`, scrivo audit in `interactions` (`interaction_type: 'system_note'`, subject = "Playbook X attivato", notes = codice/workflow/kb count) — NIENTE upsert su `partner_workflow_state` perché violerebbe il vincolo NOT NULL su `workflow_id`. Restituisco `activation_persisted: true/false`. |
| 1.4 | `supabase/functions/cadence-engine/index.ts` | Auto-execute: chiamo `generate-outreach`, poi se canale email chiamo `send-email`. Salvo `action_payload` con subject/body/sent. Se generazione/invio falliscono → `status: "failed"`. |
| 1.5 | `supabase/functions/cadence-engine/index.ts` | Pending review: pre-genero contenuto via `generate-outreach`, salvo `action_payload` con subject/body/channel. Degrado graceful se generate-outreach fallisce. |
| 1.6 | `supabase/functions/cadence-engine/index.ts` | `mapActionType`: `linkedin → send_linkedin`, default `create_task` (anziché `send_email`). |
| 1.8 | `src/v2/hooks/useEmailComposerV2.ts` | Lettura risposta: `data?.response \|\| data?.content`. Aggiorno anche il tipo generic. |

Skip 1.7 e 1.9 (già OK).

### Ordine di esecuzione
1.1 → 1.2 → 1.3 → 1.6 (mini fix sintattico) → 1.4 → 1.5 → 1.8

### Deploy
Deploy edge functions: `ai-assistant`, `cadence-engine`. La funzione `_shared/toolHandlersEnterprise.ts` è importata da `ai-assistant`, quindi va con quel deploy.

### Verifica post-fix
- Grep su sentinelle: `userId mancante`, `toolExecutors`, `Playbook .* attivato`, `send_linkedin`, `executionStatus`, `pendingPayload`, `data?.response \|\| data?.content`.
- Build TS verde.
- Smoke test:
  - `search_kb` con `userId=""` → errore esplicito.
  - `cadence-engine` POST → log mostra generazione contenuto e `executionResult` non vuoto.
  - Composer V2: click "Genera" → body popolato.

### Fuori scope (Fase 2+)
- Aggiunta colonne `active_playbook_code` su `partner_workflow_state` (richiede migration discussa a parte se serve persistenza forte del playbook).
- Refactor scope routing (già OK).
- Test E2E automatizzati dei criteri CP1.x.

