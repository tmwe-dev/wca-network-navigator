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

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `HomeAIPrompt.tsx` | `ai-assistant` (via `invokeAi`) | `home` (block, grounded) | `general` | `system_doctrine`, `sales_doctrine` | ⏳ |
| `OperativeBriefing.tsx` | `agent-execute` | `briefing` (warn, grounded) | `general` | `sales_doctrine`, `tone-and-format` | ⏳ |

## 2. Command — `/v2/command` (CommandPage)

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `useSuperMarioFlow.ts` | `super-mario` | `command` (warn) | `command` | `command_tools`, `doctrine` | ⏳ |
| Tool `analyzePartner` | `analyze-partner` | `command` | `command` | `command_tools` | ⏳ |
| Tool `calculateLeadScores` | `calculate-lead-scores` | `command` | — | `dati_partner` | ⏳ |
| Tool `deduplicateContacts` | `deduplicate-contacts` | `command` | — | `dati_partner` | ⏳ |
| Tool `parseBusinessCard` | `parse-business-card` | `command` | — | — | ⏳ |
| Tool `kbIngestDocument` | `kb-ingest-document` | `command` | — | — | ⏳ |
| Tool `dailyBriefing` | `daily-briefing` | `briefing` | `general` | — | ⏳ |
| Tool `sendWhatsapp` | `send-whatsapp` | `outreach` | `whatsapp` | `frasi_modello`, `tone-and-format` | ⏳ |
| Tool `sendLinkedin` | `send-linkedin` | `outreach` | `linkedin` | `frasi_modello` | ⏳ |
| Tool `launchMission` | `mission-executor` | `missions` | — | `procedures` | ⏳ |

## 3. CRM — `/v2/crm` (CRMPage)

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `CRMPage.tsx` (recalc lead) | `calculate-lead-scores` | n/a (invokeEdge) | — | — | ⏳ |

## 4. Contatti — `/v2/rubrica/*` (ContactDetail / BCA)

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `ContactDetailPanel.tsx` — deep_search | `ai-utility` (action=deep_search) | n/a | `general` | `dati_partner` | ⏳ |
| `BCASmartActions.tsx` | `ai-utility` | n/a | — | — | ⏳ |
| `BCADragDropOverlay.tsx` | `ai-utility` | n/a | — | — | ⏳ |

## 5. Pipeline / Acquisition — `/v2/pipeline`

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `useAcquisitionPipeline.tsx` | `ai-utility` (deep_search) | n/a | — | — | ⏳ |

## 6. Missions — `/v2/missions`

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `useMissionBuilderV2.ts` | `unified-assistant` | `mission-builder` | `general` | `procedures`, `sales_doctrine` | ⏳ |

## 7. Outreach / Email Composer

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `useDeepSearchTrigger.ts` | `enrich-partner-website` | n/a | — | `dati_partner` | ⏳ |
| `useEmailCampaignQueue.ts` pause/cancel | `process-email-queue` | n/a | — | — | ⏳ |

## 8. Funnemail Inbox — `/v2/funnemail`

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `useFunnemailInbox.ts` (2 chiamate) | `funnemail-classify` | `classify` (block, grounded) | `funnemail_classifier`, `classification` | `email_management`, `tone-and-format` | ⏳ |

## 9. Email Intelligence — `/v2/email-intelligence`

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `SmartInboxView.tsx` (2) | `save-correction-memory`, `manage-email-folders` | n/a | — | — | ⏳ |
| `AISuggestionsTab.tsx` | `refine-classification-rule` | `learning.classification.refine` | `classification` | — | ⏳ |
| `ClassificationInsightsPanel.tsx` | `apply-classification-insight` | n/a | — | — | ⏳ |
| `ManualGrouping/useGroupAssignment.ts` | `learn-from-group-correction` | `classify` | `classification` | — | ⏳ |

## 10. Email folders / Rules — hooks globali

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `useEmailFolderActions.ts` | `apply-email-rules` | n/a | — | — | ⏳ |
| `useEmailDownloadV2.ts` | `sync-emails` | n/a | — | — | ⏳ |

## 11. Agent Chat Hub — `/v2/agents`

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `AgentChatHubPage.tsx` | `save-correction-memory` | n/a | — | — | ⏳ |
| `AgentChatHubView.tsx` | `save-correction-memory` | n/a | — | — | ⏳ |

## 12. Optimus Bridge (globale)

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `useOptimusBridgeListener.ts` | `optimus-analyze` | `agent` (block, grounded) | `general` | `agent_doctrine` | ⏳ |

## 13. Sherlock (deep search v2)

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `sherlock/aiIntegrations.ts` (extract) | `sherlock-extract` | `sherlock` (block, grounded) | `content-intelligence` | `dati_partner` | ⏳ |
| `sherlock/aiIntegrations.ts` (decide) | `agentic-decide` | `sherlock` | `content-intelligence` | `dati_partner` | ⏳ |

## 14. Bulk Ops (multi-target)

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `bulkOps/verify.ts` (WA/LI/Email/Dedup) | `verify-*`, `find-import-duplicates` | n/a | — | — | ⏳ |
| `bulkOps/update.ts` | `suggest-email-groups`, `extension-dispatch-enqueue` | `classify` | `classification` | — | ⏳ |
| `bulkOps/inboundEnrich.ts` | `process-inbound-enrichment` | n/a | — | — | ⏳ |
| `bulkOps/enrichBase.ts` | `enrich-partner-website` | n/a | — | — | ⏳ |
| `bulkOps/download.ts` | `process-download-job` | n/a | — | — | ⏳ |
| `bulkOps/deepSearch.ts` | `sherlock-extract` | `sherlock` | `content-intelligence` | — | ⏳ |

## 15. Diagnostics — `/v2/diagnostics`

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `useDiagnosticsV2.ts` | `ai-assistant` | `diagnostics` | `general` | — | ⏳ |

## 16. Download Advanced

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `AdvancedTools.tsx` | `enrich-partner-website` | n/a | — | — | ⏳ |

## 17. Settings

| Componente | Edge | Scope | Prompt ctx | KB cat | Status |
|---|---|---|---|---|---|
| `AIBackupPanel.tsx` | `ai-backup` | n/a | — | — | ⏳ |
| `GeneralSettings.tsx` | `send-email` | n/a | — | — | ⏳ |

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