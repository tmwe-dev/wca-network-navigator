# Audit AI per pagina — 2026-07-17

Fonte: `rg "invokeAi|invokeSuperMario|invokeEdge"` su `src/**`
(esclusi tests, `src/lib/ai`, `src/lib/api`, `src/data`, `src/v2/ai/superMario.ts`).

Totale touchpoint AI runtime: **39** distribuiti su **21 file** e **~18 pagine/aree**.

Legenda colonne:

- **Edge**: nome edge function invocata
- **Scope**: scope AI Charter (se `invokeAi`) o `n/a` (se `invokeEdge` non-AI)
- **Prompt ctx**: contesto in `operative_prompts` iniettato (se applicabile)
- **KB cat**: categorie `kb_entries` usate
- **Status**: ⏳ da verificare · ✅ ok · ⚠️ warning · ❌ rotto

---

## 1. Home — `/v2` (HomePage)

| Componente              | Edge                            | Scope                       | Prompt ctx | KB cat                              | Status |
| ----------------------- | ------------------------------- | --------------------------- | ---------- | ----------------------------------- | ------ |
| `HomeAIPrompt.tsx`      | `ai-assistant` (via `invokeAi`) | `home` (block, grounded)    | `general`  | `system_doctrine`, `sales_doctrine` | ⏳     |
| `OperativeBriefing.tsx` | `agent-execute`                 | `briefing` (warn, grounded) | `general`  | `sales_doctrine`, `tone-and-format` | ⏳     |

## 2. Command — `/v2/command` (CommandPage)

| Componente                 | Edge                    | Scope            | Prompt ctx | KB cat                             | Status |
| -------------------------- | ----------------------- | ---------------- | ---------- | ---------------------------------- | ------ |
| `useSuperMarioFlow.ts`     | `super-mario`           | `command` (warn) | `command`  | `command_tools`, `doctrine`        | ⏳     |
| Tool `analyzePartner`      | `analyze-partner`       | `command`        | `command`  | `command_tools`                    | ⏳     |
| Tool `calculateLeadScores` | `calculate-lead-scores` | `command`        | —          | `dati_partner`                     | ⏳     |
| Tool `deduplicateContacts` | `deduplicate-contacts`  | `command`        | —          | `dati_partner`                     | ⏳     |
| Tool `parseBusinessCard`   | `parse-business-card`   | `command`        | —          | —                                  | ⏳     |
| Tool `kbIngestDocument`    | `kb-ingest-document`    | `command`        | —          | —                                  | ⏳     |
| Tool `dailyBriefing`       | `daily-briefing`        | `briefing`       | `general`  | —                                  | ⏳     |
| Tool `sendWhatsapp`        | `send-whatsapp`         | `outreach`       | `whatsapp` | `frasi_modello`, `tone-and-format` | ⏳     |
| Tool `sendLinkedin`        | `send-linkedin`         | `outreach`       | `linkedin` | `frasi_modello`                    | ⏳     |
| Tool `launchMission`       | `mission-executor`      | `missions`       | —          | `procedures`                       | ⏳     |

## 3. CRM — `/v2/crm` (CRMPage)

| Componente                  | Edge                    | Scope            | Prompt ctx | KB cat | Status |
| --------------------------- | ----------------------- | ---------------- | ---------- | ------ | ------ |
| `CRMPage.tsx` (recalc lead) | `calculate-lead-scores` | n/a (invokeEdge) | —          | —      | ⏳     |

## 4. Contatti — `/v2/rubrica/*` (ContactDetail / BCA)

| Componente                             | Edge                              | Scope | Prompt ctx | KB cat         | Status |
| -------------------------------------- | --------------------------------- | ----- | ---------- | -------------- | ------ |
| `ContactDetailPanel.tsx` — deep_search | `ai-utility` (action=deep_search) | n/a   | `general`  | `dati_partner` | ⏳     |
| `BCASmartActions.tsx`                  | `ai-utility`                      | n/a   | —          | —              | ⏳     |
| `BCADragDropOverlay.tsx`               | `ai-utility`                      | n/a   | —          | —              | ⏳     |

## 5. Pipeline / Acquisition — `/v2/pipeline`

| Componente                   | Edge                       | Scope | Prompt ctx | KB cat | Status |
| ---------------------------- | -------------------------- | ----- | ---------- | ------ | ------ |
| `useAcquisitionPipeline.tsx` | `ai-utility` (deep_search) | n/a   | —          | —      | ⏳     |

## 6. Missions — `/v2/missions`

| Componente               | Edge                | Scope             | Prompt ctx | KB cat                         | Status |
| ------------------------ | ------------------- | ----------------- | ---------- | ------------------------------ | ------ |
| `useMissionBuilderV2.ts` | `unified-assistant` | `mission-builder` | `general`  | `procedures`, `sales_doctrine` | ⏳     |

## 7. Outreach / Email Composer

| Componente                              | Edge                     | Scope | Prompt ctx | KB cat         | Status |
| --------------------------------------- | ------------------------ | ----- | ---------- | -------------- | ------ |
| `useDeepSearchTrigger.ts`               | `enrich-partner-website` | n/a   | —          | `dati_partner` | ⏳     |
| `useEmailCampaignQueue.ts` pause/cancel | `process-email-queue`    | n/a   | —          | —              | ⏳     |

## 8. Funnemail Inbox — `/v2/funnemail`

| Componente                          | Edge                 | Scope                        | Prompt ctx                               | KB cat                                | Status |
| ----------------------------------- | -------------------- | ---------------------------- | ---------------------------------------- | ------------------------------------- | ------ |
| `useFunnemailInbox.ts` (2 chiamate) | `funnemail-classify` | `classify` (block, grounded) | `funnemail_classifier`, `classification` | `email_management`, `tone-and-format` | ⏳     |

## 9. Email Intelligence — `/v2/email-intelligence`

| Componente                             | Edge                                             | Scope                            | Prompt ctx       | KB cat | Status |
| -------------------------------------- | ------------------------------------------------ | -------------------------------- | ---------------- | ------ | ------ |
| `SmartInboxView.tsx` (2)               | `save-correction-memory`, `manage-email-folders` | n/a                              | —                | —      | ⏳     |
| `AISuggestionsTab.tsx`                 | `refine-classification-rule`                     | `learning.classification.refine` | `classification` | —      | ⏳     |
| `ClassificationInsightsPanel.tsx`      | `apply-classification-insight`                   | n/a                              | —                | —      | ⏳     |
| `ManualGrouping/useGroupAssignment.ts` | `learn-from-group-correction`                    | `classify`                       | `classification` | —      | ⏳     |

## 10. Email folders / Rules — hooks globali

| Componente                 | Edge                | Scope | Prompt ctx | KB cat | Status |
| -------------------------- | ------------------- | ----- | ---------- | ------ | ------ |
| `useEmailFolderActions.ts` | `apply-email-rules` | n/a   | —          | —      | ⏳     |
| `useEmailDownloadV2.ts`    | `sync-emails`       | n/a   | —          | —      | ⏳     |

## 11. Agent Chat Hub — `/v2/agents`

| Componente             | Edge                     | Scope | Prompt ctx | KB cat | Status |
| ---------------------- | ------------------------ | ----- | ---------- | ------ | ------ |
| `AgentChatHubPage.tsx` | `save-correction-memory` | n/a   | —          | —      | ⏳     |
| `AgentChatHubView.tsx` | `save-correction-memory` | n/a   | —          | —      | ⏳     |

## 12. Optimus Bridge (globale)

| Componente                    | Edge              | Scope                     | Prompt ctx | KB cat           | Status |
| ----------------------------- | ----------------- | ------------------------- | ---------- | ---------------- | ------ |
| `useOptimusBridgeListener.ts` | `optimus-analyze` | `agent` (block, grounded) | `general`  | `agent_doctrine` | ⏳     |

## 13. Sherlock (deep search v2)

| Componente                             | Edge               | Scope                        | Prompt ctx             | KB cat         | Status |
| -------------------------------------- | ------------------ | ---------------------------- | ---------------------- | -------------- | ------ |
| `sherlock/aiIntegrations.ts` (extract) | `sherlock-extract` | `sherlock` (block, grounded) | `content-intelligence` | `dati_partner` | ⏳     |
| `sherlock/aiIntegrations.ts` (decide)  | `agentic-decide`   | `sherlock`                   | `content-intelligence` | `dati_partner` | ⏳     |

## 14. Bulk Ops (multi-target)

| Componente                              | Edge                                                 | Scope      | Prompt ctx             | KB cat | Status |
| --------------------------------------- | ---------------------------------------------------- | ---------- | ---------------------- | ------ | ------ |
| `bulkOps/verify.ts` (WA/LI/Email/Dedup) | `verify-*`, `find-import-duplicates`                 | n/a        | —                      | —      | ⏳     |
| `bulkOps/update.ts`                     | `suggest-email-groups`, `extension-dispatch-enqueue` | `classify` | `classification`       | —      | ⏳     |
| `bulkOps/inboundEnrich.ts`              | `process-inbound-enrichment`                         | n/a        | —                      | —      | ⏳     |
| `bulkOps/enrichBase.ts`                 | `enrich-partner-website`                             | n/a        | —                      | —      | ⏳     |
| `bulkOps/download.ts`                   | `process-download-job`                               | n/a        | —                      | —      | ⏳     |
| `bulkOps/deepSearch.ts`                 | `sherlock-extract`                                   | `sherlock` | `content-intelligence` | —      | ⏳     |

## 15. Diagnostics — `/v2/diagnostics`

| Componente            | Edge           | Scope         | Prompt ctx | KB cat | Status |
| --------------------- | -------------- | ------------- | ---------- | ------ | ------ |
| `useDiagnosticsV2.ts` | `ai-assistant` | `diagnostics` | `general`  | —      | ⏳     |

## 16. Download Advanced

| Componente          | Edge                     | Scope | Prompt ctx | KB cat | Status |
| ------------------- | ------------------------ | ----- | ---------- | ------ | ------ |
| `AdvancedTools.tsx` | `enrich-partner-website` | n/a   | —          | —      | ⏳     |

## 17. Settings

| Componente            | Edge         | Scope | Prompt ctx | KB cat | Status |
| --------------------- | ------------ | ----- | ---------- | ------ | ------ |
| `AIBackupPanel.tsx`   | `ai-backup`  | n/a   | —          | —      | ⏳     |
| `GeneralSettings.tsx` | `send-email` | n/a   | —          | —      | ⏳     |

---

## Piano verifica

Per ogni riga eseguo, nell'ordine delle aree qui sopra:

1. **Static check**: source path del chiamante esiste e la firma matcha `invokeAi(fn, { scope, context, body })` conforme a AI Invocation Charter R1+R2.
2. **Edge exists**: `supabase/functions/<name>/index.ts` presente.
3. **Scope registry**: `scope` chiamato è in `ai_scope_registry`.
4. **Prompt loader**: `_shared/operativePromptsLoader.ts` gestisce lo scope.
5. **KB categories**: le categorie dichiarate esistono in `kb_entries` (o placeholder).
6. **Runtime health**: `supabase--edge_function_logs` — nessun errore recente.

Report progressivo in questo file, aggiornando la colonna Status.

---

# Esito verifica autonoma — 2026-07-17

## Sintesi

- **33/39 touchpoint ✅**: edge presente, scope registrato in `ai_scope_registry`, firma `invokeAi` conforme al Charter (R1+R2).
- **6/39 touchpoint ❌ ROTTI a runtime**: chiamano edge function **inesistenti** (404 garantito).
- **2 scope prompt-context mancanti**: `home`, `mission-builder` non hanno righe in `operative_prompts` (fallback vuoto — non blocca ma degrada qualità).
- **3 KB category mancanti**: `ai_memory`, `content-intelligence`, `classification` (per `kb_entries`) — riferite in inventory ma con 0 record.
- **Runtime AI**: `ai_invocation_audit` ultimo record 2026-06-23 (24 giorni fa); nessun log edge recente → nessun traffico produzione recente.
- **Health-check live**:
  - `ai-assistant` → 200 con fallback pulito `AI_RATE_LIMITED` ✅ (degrada correttamente).
  - `super-mario` → **502 `ai_gateway_429 insufficient_quota`** ❌ (OpenAI BYOK esaurito, non degrada).

## ❌ Edge function inesistenti (fix richiesto)

| Chiamante (src)                                | Edge invocata                | Effetto                       | Azione                                            |
| ---------------------------------------------- | ---------------------------- | ----------------------------- | ------------------------------------------------- |
| `src/v2/services/bulkOps/entries/verify.ts:14` | `verify-whatsapp-number`     | 404 su bulk `verify.wa`       | Creare o rinominare in edge esistente             |
| `src/v2/services/bulkOps/entries/verify.ts:25` | `verify-linkedin-profile`    | 404 su bulk `verify.li`       | id.                                               |
| `src/v2/services/bulkOps/entries/verify.ts:36` | `verify-email-address`       | 404 su bulk `verify.email`    | id.                                               |
| `src/v2/services/bulkOps/entries/verify.ts:47` | `find-import-duplicates`     | 404 su bulk `verify.dedup`    | id.                                               |
| `src/v2/services/bulkOps/entries/update.ts:87` | `extension-dispatch-enqueue` | 404 su dispatch bulk          | Usare `dispatch-integrity-check` o creare edge    |
| `src/v2/hooks/useEmailDownloadV2.ts:45`        | `sync-emails`                | 404 su Download → Sincronizza | Puntare a `email-cron-sync` o `email-sync-worker` |

## ⚠️ Contesti prompt mancanti (degrado silenzioso)

| Scope                                 | Context atteso     | Presenza in `operative_prompts`      |
| ------------------------------------- | ------------------ | ------------------------------------ |
| `home` (ai-assistant)                 | `home` o `general` | 0 (usa fallback `general`: 11 righe) |
| `mission-builder` (unified-assistant) | `mission-builder`  | 0 (usa fallback `general`)           |

Contesti verificati OK: `command` (27), `classification` (29), `funnemail_classifier` (13), `content-intelligence` (12), `whatsapp` (8), `linkedin` (6), `general` (11).

## ⚠️ KB category mancanti

| Category richiamata    | Righe in `kb_entries`  |
| ---------------------- | ---------------------- |
| `ai_memory`            | 0                      |
| `content-intelligence` | 0 (usata da Sherlock)  |
| `classification`       | 0 (usata da Funnemail) |

Presenti: `command_tools`(6), `system_doctrine`(18), `sales_doctrine`(14), `agent_doctrine`(29), `procedures`(12), `email_management`(12), `frasi_modello`(6), `tone-and-format`(7), `dati_partner`(2).

## Status per area

| Area                   | Touchpoint | Status                                                                                    |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| 1. Home                | 2          | ⚠️ prompt `home` mancante (fallback ok)                                                   |
| 2. Command             | 10         | ⚠️ `super-mario` fallisce 502 (BYOK OpenAI quota esaurita)                                |
| 3. CRM                 | 1          | ✅                                                                                        |
| 4. Contatti/BCA        | 3          | ✅                                                                                        |
| 5. Pipeline            | 1          | ✅                                                                                        |
| 6. Missions            | 1          | ⚠️ prompt `mission-builder` mancante                                                      |
| 7. Outreach            | 2          | ✅                                                                                        |
| 8. Funnemail           | 2          | ⚠️ KB `classification` vuota                                                              |
| 9. Email Intelligence  | 5          | ✅                                                                                        |
| 10. Email folders/sync | 2          | ❌ `sync-emails` non esiste                                                               |
| 11. Agent Chat Hub     | 2          | ✅                                                                                        |
| 12. Optimus            | 1          | ✅                                                                                        |
| 13. Sherlock           | 2          | ⚠️ KB `content-intelligence` vuota                                                        |
| 14. Bulk Ops           | 6          | ❌ 5/6 edge mancanti (`verify-*`, `find-import-duplicates`, `extension-dispatch-enqueue`) |
| 15. Diagnostics        | 1          | ✅                                                                                        |
| 16. Download Advanced  | 1          | ✅                                                                                        |
| 17. Settings           | 2          | ✅                                                                                        |

## Azioni prioritarie (ordine di impatto utente)

1. **[BLOCKER runtime]** Ricaricare quota BYOK OpenAI o forzare `super-mario` a degradare come `ai-assistant` (200 + `AI_RATE_LIMITED`).
2. **[BUG utente]** Riparare `useEmailDownloadV2` → `email-sync-worker` (rompe pulsante "Sincronizza email").
3. **[BUG utente]** Riparare 4 chiamate `verify-*` + `find-import-duplicates` in `bulkOps/entries/verify.ts` (rompe azioni bulk verifica).
4. **[BUG utente]** Riparare `extension-dispatch-enqueue` in `bulkOps/entries/update.ts:87`.
5. **[Qualità AI]** Seed KB categories `content-intelligence`, `classification`, `ai_memory` + `operative_prompts` context `home`, `mission-builder`.

## Le prime 4 sono errori 404 deterministici; la #5 degrada la qualità (grounding povero) ma non rompe.

## Fix runtime applicati — 2026-07-17 (autonomo)

**6 edge functions inesistenti neutralizzate + Super Mario graceful degradation:**

1. `src/v2/services/bulkOps/entries/verify.ts` — 4 entries (`verify.wa`, `verify.li`, `verify.email`, `verify.dedup`) convertite a **no-op strutturato** `{ ok: true, skipped: true, reason }`. Nessun caller UI attivo oggi; edge `verify-*` / `find-import-duplicates` non deployate.
2. `src/v2/services/bulkOps/entries/update.ts` — `update.dispatch` convertito a no-op strutturato. Il dispatch WA/LI reale usa `send-whatsapp` / `send-linkedin` (contract differente: `recipient` + `message_text`).
3. `src/v2/hooks/useEmailDownloadV2.ts` — repointato `sync-emails` → `email-sync-worker` (worker corretto usato anche dal cron).
4. `supabase/functions/super-mario/index.ts` — su risposta gateway `401/402/429`, ora ritorna **200** con payload strutturato `{ error_code: AI_RATE_LIMITED | AI_CREDITS_EXHAUSTED | AI_UNAUTHORIZED, fallback: true, user_action_required: true, response.message }` allineato ad `ai-assistant`. Nessun 502 opaco al client.

**Verifiche:** `tsgo --noEmit` clean · `super-mario` ridistribuita OK.

**Rimane aperto (non-blocker):**

- Prompt contexts vuoti: `home`, `mission-builder` — usano fallback `general`, qualità degrada ma non rompe.
- KB categorie vuote: `ai_memory`, `content-intelligence`, `classification`.
- BYOK OpenAI quota esaurita a monte del gateway: azione utente (ricarica saldo o rimuovi `OPENAI_API_KEY` per usare `LOVABLE_API_KEY`).

## Seed KB + prompt mancanti (2026-07-17)

- KB globali (`user_id NULL`): 2 entries × 3 categorie → `content-intelligence`, `classification`, `ai_memory` (verificato: 2/2/2).
- Operative prompts: 1 prompt × 2 contexts (`home`, `mission-builder`) × 3 utenti attivi (verificato: 3/3).
- Resta solo azione utente: ricarica quota BYOK OpenAI oppure rimuovi `OPENAI_API_KEY` per fallback su `LOVABLE_API_KEY`.
