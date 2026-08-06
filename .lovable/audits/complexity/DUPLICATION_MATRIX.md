# DUPLICATION_MATRIX.md

## Duplicati esatti (SHA1 identico)

- `6093ebd3fa421903f3779287af3249c3c45576a2`: `src/components/campaigns/AuroraBorealis.tsx`, `src/standalone-globe/components/AuroraBorealis.tsx`
- `c7e1bd202a5d794a547117a65ed918a92581cd29`: `supabase/functions/apply-email-rules/caCerts.ts`, `supabase/functions/backfill-email-rules/caCerts.ts`, `supabase/functions/check-inbox-booking/caCerts.ts`, `supabase/functions/check-inbox/caCerts.ts`, `supabase/functions/imap-list-folders/caCerts.ts`, `supabase/functions/manage-email-folders/caCerts.ts`
- `0881774fac786b811ee5a5f45ba6467af589237d`: `supabase/functions/check-inbox-booking/bounceDetector.ts`, `supabase/functions/check-inbox/bounceDetector.ts`
- `4747699711f5753294b50319cebd45f276cb2748`: `supabase/functions/check-inbox-booking/enqueueEnrichment.ts`, `supabase/functions/check-inbox/enqueueEnrichment.ts`
- `fa183ca171dab8607f5e31f72f6b8bc86abafa7a`: `supabase/functions/check-inbox-booking/index.integration.test.ts`, `supabase/functions/check-inbox/index.integration.test.ts`
- `6519ab73fc1121dfb32d6fbfb86fdecec4059a0f`: `supabase/functions/check-inbox-booking/index_test.ts`, `supabase/functions/check-inbox/index_test.ts`
- `26cf95955bff26f4f3227f6715c5f6ac7863a8fa`: `supabase/functions/check-inbox-booking/mimeDecoder.ts`, `supabase/functions/check-inbox/mimeDecoder.ts`
- `c24298de7c4fc68c0082e0cdab9e7b65a863160d`: `supabase/migrations/20260403010412_5a73dc6d-e605-4933-99d5-45ef06cb1fa6.sql`, `supabase/migrations/20260403010449_37a8cfe4-d20a-438d-9370-15578b2b9f72.sql`

## Near-duplicati (fingerprint primi 8k identico, SHA1 diverso)

- `f325ab32e860d2f2`: `src/components/campaigns/AuroraBorealis.tsx`, `src/standalone-globe/components/AuroraBorealis.tsx`
- `891eb3820b99dea8`: `supabase/functions/apply-email-rules/caCerts.ts`, `supabase/functions/backfill-email-rules/caCerts.ts`, `supabase/functions/check-inbox-booking/caCerts.ts`, `supabase/functions/check-inbox/caCerts.ts`, `supabase/functions/imap-list-folders/caCerts.ts`, `supabase/functions/manage-email-folders/caCerts.ts`
- `e221c39a4dbab9dd`: `supabase/functions/check-inbox-booking/bounceDetector.ts`, `supabase/functions/check-inbox/bounceDetector.ts`
- `e079706f75ca9ec9`: `supabase/functions/check-inbox-booking/enqueueEnrichment.ts`, `supabase/functions/check-inbox/enqueueEnrichment.ts`
- `da8341d34be20519`: `supabase/functions/check-inbox-booking/index.integration.test.ts`, `supabase/functions/check-inbox/index.integration.test.ts`
- `1e3c1a66f32dbb9d`: `supabase/functions/check-inbox-booking/index_test.ts`, `supabase/functions/check-inbox/index_test.ts`
- `82f304d8e7b3a10c`: `supabase/functions/check-inbox-booking/mimeDecoder.ts`, `supabase/functions/check-inbox/mimeDecoder.ts`
- `c24298de7c4fc68c`: `supabase/migrations/20260403010412_5a73dc6d-e605-4933-99d5-45ef06cb1fa6.sql`, `supabase/migrations/20260403010449_37a8cfe4-d20a-438d-9370-15578b2b9f72.sql`
- `0203569a90f5b846`: `supabase/migrations/20260419100310_b4b8e4af-b700-4e2b-84ce-6fd90c4045cb.sql`, `supabase/migrations/20260420034510_e1d1b58c-95ce-46ab-9f3c-5fba23c6fb55.sql`

## Overlap v1↔v2 (stesso basename)

- `src/v2/agent/runtime/prompts/system.ts` ↔ `src/lib/queryKeysParts/system.ts`
- `src/v2/agent/runtime/tools/index.ts` ↔ `src/components/email-intelligence/management/index.ts`, `src/components/email-intelligence/manual-grouping/index.ts`, `src/components/global/filters-drawer/index.ts`, `src/components/settings/content-manager/index.ts`, `src/components/ui/sidebar/index.ts`, `src/constants/agentTemplates/index.ts`, `src/constants/operationsProcedures/index.ts`, `src/data/atecoRanking/index.ts`, `src/data/contacts/index.ts`, `src/data/index.ts`, `src/hooks/email-composer/index.ts`, `src/i18n/index.ts`, `src/integrations/lovable/index.ts`, `src/lib/import/index.ts`, `src/lib/mcp/index.ts`, `src/standalone-globe/index.ts`
- `src/v2/agent/runtime/tools/kb.ts` ↔ `src/constants/agentTemplates/kb.ts`
- `src/v2/hooks/companyList/useActiveFilterChips.ts` ↔ `src/components/shared/entity-toolbar/useActiveFilterChips.ts`
- `src/v2/io/edge/client.ts` ↔ `src/integrations/supabase/client.ts`
- `src/v2/io/supabase/mutations/activities.ts` ↔ `src/data/activities.ts`
- `src/v2/io/supabase/mutations/agents.ts` ↔ `src/data/agents.ts`
- `src/v2/io/supabase/mutations/contacts.ts` ↔ `src/data/contacts.ts`, `src/types/contacts.ts`
- `src/v2/io/supabase/mutations/partners.ts` ↔ `src/data/partners.ts`
- `src/v2/io/supabase/mutations/prospects.ts` ↔ `src/data/prospects.ts`
- `src/v2/io/supabase/queries/activities.ts` ↔ `src/data/activities.ts`
- `src/v2/io/supabase/queries/agents.ts` ↔ `src/data/agents.ts`
- `src/v2/io/supabase/queries/contacts.ts` ↔ `src/data/contacts.ts`, `src/types/contacts.ts`
- `src/v2/io/supabase/queries/partners.ts` ↔ `src/data/partners.ts`
- `src/v2/io/supabase/queries/prospects.ts` ↔ `src/data/prospects.ts`
- `src/v2/services/bulkOps/index.ts` ↔ `src/components/email-intelligence/management/index.ts`, `src/components/email-intelligence/manual-grouping/index.ts`, `src/components/global/filters-drawer/index.ts`, `src/components/settings/content-manager/index.ts`, `src/components/ui/sidebar/index.ts`, `src/constants/agentTemplates/index.ts`, `src/constants/operationsProcedures/index.ts`, `src/data/atecoRanking/index.ts`, `src/data/contacts/index.ts`, `src/data/index.ts`, `src/hooks/email-composer/index.ts`, `src/i18n/index.ts`, `src/integrations/lovable/index.ts`, `src/lib/import/index.ts`, `src/lib/mcp/index.ts`, `src/standalone-globe/index.ts`
- `src/v2/services/bulkOps/types.ts` ↔ `src/components/acquisition/types.ts`, `src/components/global/email-picker/types.ts`, `src/components/global/filters-drawer/types.ts`, `src/components/missions/steps/types.ts`, `src/constants/agentPromptsParts/types.ts`, `src/constants/operationsProcedures/types.ts`, `src/data/atecoRanking/types.ts`, `src/data/contacts/types.ts`, `src/hooks/diagnostics/types.ts`, `src/hooks/email-composer/types.ts`, `src/lib/import/types.ts`, `src/lib/inbox/types.ts`, `src/standalone-globe/types.ts`
- `src/v2/services/sherlock/rateLimiter.ts` ↔ `src/lib/api/rateLimiter.ts`
- `src/v2/ui/atoms/EmptyState.tsx` ↔ `src/components/shared/EmptyState.tsx`, `src/components/ui/EmptyState.tsx`
- `src/v2/ui/atoms/PageErrorBoundary.tsx` ↔ `src/components/ui/PageErrorBoundary.tsx`
- `src/v2/ui/molecules/ActiveFiltersBar/ActiveFiltersBar.tsx` ↔ `src/components/email-intelligence/manual-grouping/ActiveFiltersBar.tsx`
- `src/v2/ui/molecules/ActiveFiltersBar/index.ts` ↔ `src/components/email-intelligence/management/index.ts`, `src/components/email-intelligence/manual-grouping/index.ts`, `src/components/global/filters-drawer/index.ts`, `src/components/settings/content-manager/index.ts`, `src/components/ui/sidebar/index.ts`, `src/constants/agentTemplates/index.ts`, `src/constants/operationsProcedures/index.ts`, `src/data/atecoRanking/index.ts`, `src/data/contacts/index.ts`, `src/data/index.ts`, `src/hooks/email-composer/index.ts`, `src/i18n/index.ts`, `src/integrations/lovable/index.ts`, `src/lib/import/index.ts`, `src/lib/mcp/index.ts`, `src/standalone-globe/index.ts`
- `src/v2/ui/molecules/CompanyCardList/index.ts` ↔ `src/components/email-intelligence/management/index.ts`, `src/components/email-intelligence/manual-grouping/index.ts`, `src/components/global/filters-drawer/index.ts`, `src/components/settings/content-manager/index.ts`, `src/components/ui/sidebar/index.ts`, `src/constants/agentTemplates/index.ts`, `src/constants/operationsProcedures/index.ts`, `src/data/atecoRanking/index.ts`, `src/data/contacts/index.ts`, `src/data/index.ts`, `src/hooks/email-composer/index.ts`, `src/i18n/index.ts`, `src/integrations/lovable/index.ts`, `src/lib/import/index.ts`, `src/lib/mcp/index.ts`, `src/standalone-globe/index.ts`
- `src/v2/ui/molecules/CompanyCardList/types.ts` ↔ `src/components/acquisition/types.ts`, `src/components/global/email-picker/types.ts`, `src/components/global/filters-drawer/types.ts`, `src/components/missions/steps/types.ts`, `src/constants/agentPromptsParts/types.ts`, `src/constants/operationsProcedures/types.ts`, `src/data/atecoRanking/types.ts`, `src/data/contacts/types.ts`, `src/hooks/diagnostics/types.ts`, `src/hooks/email-composer/types.ts`, `src/lib/import/types.ts`, `src/lib/inbox/types.ts`, `src/standalone-globe/types.ts`
- `src/v2/ui/molecules/EmailCard/index.ts` ↔ `src/components/email-intelligence/management/index.ts`, `src/components/email-intelligence/manual-grouping/index.ts`, `src/components/global/filters-drawer/index.ts`, `src/components/settings/content-manager/index.ts`, `src/components/ui/sidebar/index.ts`, `src/constants/agentTemplates/index.ts`, `src/constants/operationsProcedures/index.ts`, `src/data/atecoRanking/index.ts`, `src/data/contacts/index.ts`, `src/data/index.ts`, `src/hooks/email-composer/index.ts`, `src/i18n/index.ts`, `src/integrations/lovable/index.ts`, `src/lib/import/index.ts`, `src/lib/mcp/index.ts`, `src/standalone-globe/index.ts`
- `src/v2/ui/molecules/EmailCard/types.ts` ↔ `src/components/acquisition/types.ts`, `src/components/global/email-picker/types.ts`, `src/components/global/filters-drawer/types.ts`, `src/components/missions/steps/types.ts`, `src/constants/agentPromptsParts/types.ts`, `src/constants/operationsProcedures/types.ts`, `src/data/atecoRanking/types.ts`, `src/data/contacts/types.ts`, `src/hooks/diagnostics/types.ts`, `src/hooks/email-composer/types.ts`, `src/lib/import/types.ts`, `src/lib/inbox/types.ts`, `src/standalone-globe/types.ts`
- `src/v2/ui/molecules/ListToolbar/index.ts` ↔ `src/components/email-intelligence/management/index.ts`, `src/components/email-intelligence/manual-grouping/index.ts`, `src/components/global/filters-drawer/index.ts`, `src/components/settings/content-manager/index.ts`, `src/components/ui/sidebar/index.ts`, `src/constants/agentTemplates/index.ts`, `src/constants/operationsProcedures/index.ts`, `src/data/atecoRanking/index.ts`, `src/data/contacts/index.ts`, `src/data/index.ts`, `src/hooks/email-composer/index.ts`, `src/i18n/index.ts`, `src/integrations/lovable/index.ts`, `src/lib/import/index.ts`, `src/lib/mcp/index.ts`, `src/standalone-globe/index.ts`
- `src/v2/ui/pages/cestinone/tabs.tsx` ↔ `src/components/ui/tabs.tsx`
- `src/v2/ui/pages/cestinone/utils.ts` ↔ `src/components/campaigns/globe/utils.ts`, `src/hooks/email-composer/utils.ts`, `src/lib/utils.ts`, `src/standalone-globe/utils.ts`
- `src/v2/ui/pages/command/constants.ts` ↔ `src/components/global/filters-drawer/constants.ts`, `src/components/settings/content-manager/constants.ts`, `src/hooks/useAddContactForm/constants.ts`
- `src/v2/ui/pages/command/tools/blacklist.ts` ↔ `src/data/blacklist.ts`
- `src/v2/ui/pages/command/tools/composeEmail/types.ts` ↔ `src/components/acquisition/types.ts`, `src/components/global/email-picker/types.ts`, `src/components/global/filters-drawer/types.ts`, `src/components/missions/steps/types.ts`, `src/constants/agentPromptsParts/types.ts`, `src/constants/operationsProcedures/types.ts`, `src/data/atecoRanking/types.ts`, `src/data/contacts/types.ts`, `src/hooks/diagnostics/types.ts`, `src/hooks/email-composer/types.ts`, `src/lib/import/types.ts`, `src/lib/inbox/types.ts`, `src/standalone-globe/types.ts`
- `src/v2/ui/pages/command/tools/types.ts` ↔ `src/components/acquisition/types.ts`, `src/components/global/email-picker/types.ts`, `src/components/global/filters-drawer/types.ts`, `src/components/missions/steps/types.ts`, `src/constants/agentPromptsParts/types.ts`, `src/constants/operationsProcedures/types.ts`, `src/data/atecoRanking/types.ts`, `src/data/contacts/types.ts`, `src/hooks/diagnostics/types.ts`, `src/hooks/email-composer/types.ts`, `src/lib/import/types.ts`, `src/lib/inbox/types.ts`, `src/standalone-globe/types.ts`
- `src/v2/ui/pages/email-forge/DeepSearchCanvas.tsx` ↔ `src/components/operations/DeepSearchCanvas.tsx`
- `src/v2/ui/pages/email-lab/FunnemailTab.tsx` ↔ `src/components/email-intelligence/FunnemailTab.tsx`
- `src/v2/ui/pages/funnemail-inbox/utils.ts` ↔ `src/components/campaigns/globe/utils.ts`, `src/hooks/email-composer/utils.ts`, `src/lib/utils.ts`, `src/standalone-globe/utils.ts`
- `src/v2/ui/pages/prompt-lab/hooks/useLabAgent/types.ts` ↔ `src/components/acquisition/types.ts`, `src/components/global/email-picker/types.ts`, `src/components/global/filters-drawer/types.ts`, `src/components/missions/steps/types.ts`, `src/constants/agentPromptsParts/types.ts`, `src/constants/operationsProcedures/types.ts`, `src/data/atecoRanking/types.ts`, `src/data/contacts/types.ts`, `src/hooks/diagnostics/types.ts`, `src/hooks/email-composer/types.ts`, `src/lib/import/types.ts`, `src/lib/inbox/types.ts`, `src/standalone-globe/types.ts`
- `src/v2/ui/pages/prompt-lab/promptReader/constants.ts` ↔ `src/components/global/filters-drawer/constants.ts`, `src/components/settings/content-manager/constants.ts`, `src/hooks/useAddContactForm/constants.ts`
- `src/v2/ui/pages/prompt-lab/promptReader/utils.ts` ↔ `src/components/campaigns/globe/utils.ts`, `src/hooks/email-composer/utils.ts`, `src/lib/utils.ts`, `src/standalone-globe/utils.ts`
- `src/v2/ui/pages/prompt-lab/types.ts` ↔ `src/components/acquisition/types.ts`, `src/components/global/email-picker/types.ts`, `src/components/global/filters-drawer/types.ts`, `src/components/missions/steps/types.ts`, `src/constants/agentPromptsParts/types.ts`, `src/constants/operationsProcedures/types.ts`, `src/data/atecoRanking/types.ts`, `src/data/contacts/types.ts`, `src/hooks/diagnostics/types.ts`, `src/hooks/email-composer/types.ts`, `src/lib/import/types.ts`, `src/lib/inbox/types.ts`, `src/standalone-globe/types.ts`
- `src/v2/ui/pages/prompt-lab/utils/fileParser.ts` ↔ `src/lib/import/fileParser.ts`
- `src/v2/ui/pages/telemetry/constants.ts` ↔ `src/components/global/filters-drawer/constants.ts`, `src/components/settings/content-manager/constants.ts`, `src/hooks/useAddContactForm/constants.ts`
- `src/v2/ui/pages/telemetry/index.ts` ↔ `src/components/email-intelligence/management/index.ts`, `src/components/email-intelligence/manual-grouping/index.ts`, `src/components/global/filters-drawer/index.ts`, `src/components/settings/content-manager/index.ts`, `src/components/ui/sidebar/index.ts`, `src/constants/agentTemplates/index.ts`, `src/constants/operationsProcedures/index.ts`, `src/data/atecoRanking/index.ts`, `src/data/contacts/index.ts`, `src/data/index.ts`, `src/hooks/email-composer/index.ts`, `src/i18n/index.ts`, `src/integrations/lovable/index.ts`, `src/lib/import/index.ts`, `src/lib/mcp/index.ts`, `src/standalone-globe/index.ts`
- `src/v2/ui/pages/telemetry/types.ts` ↔ `src/components/acquisition/types.ts`, `src/components/global/email-picker/types.ts`, `src/components/global/filters-drawer/types.ts`, `src/components/missions/steps/types.ts`, `src/constants/agentPromptsParts/types.ts`, `src/constants/operationsProcedures/types.ts`, `src/data/atecoRanking/types.ts`, `src/data/contacts/types.ts`, `src/hooks/diagnostics/types.ts`, `src/hooks/email-composer/types.ts`, `src/lib/import/types.ts`, `src/lib/inbox/types.ts`, `src/standalone-globe/types.ts`
- `src/v2/ui/pages/telemetry/utils.ts` ↔ `src/components/campaigns/globe/utils.ts`, `src/hooks/email-composer/utils.ts`, `src/lib/utils.ts`, `src/standalone-globe/utils.ts`

## Gruppi Edge Functions con prefisso condiviso (>=3)

- \*\*\*\* (4): `_shared`, `_shared`, `_shared`, `_shared`
- **agent** (9): `agent-audit`, `agent-autonomous-cycle`, `agent-autopilot-worker`, `agent-execute`, `agent-execute`, `agent-loop`, `agent-prompt-refiner`, `agent-simulate`, `agent-task-drainer`
- **ai** (11): `ai-arena-suggest`, `ai-assistant`, `ai-backup`, `ai-deep-search-helper`, `ai-gateway-micro`, `ai-match-business-cards`, `ai-monitor`, `ai-query-planner`, `ai-test-runner`, `ai-tracking-healthcheck`, `ai-utility`
- **analyze** (3): `analyze-email-edit`, `analyze-import-structure`, `analyze-partner`
- **check** (3): `check-external-db`, `check-inbox`, `check-inbox-booking`
- **classify** (3): `classify-emails-batch`, `classify-inbound-content`, `classify-inbound-message`
- **email** (4): `email-cron-sync`, `email-delivery-webhook`, `email-imap-proxy`, `email-sync-worker`
- **funnemail** (8): `funnemail-auto-route`, `funnemail-backfill-inbound`, `funnemail-classify`, `funnemail-policy-engine`, `funnemail-policy-executor`, `funnemail-reminders-tick`, `funnemail-scout-sender`, `funnemail-send-autoresponder`
- **generate** (4): `generate-aliases`, `generate-content`, `generate-email`, `generate-outreach`
- **get** (3): `get-linkedin-credentials`, `get-ra-credentials`, `get-wca-credentials`
- **kb** (7): `kb-doctrine-audit`, `kb-embed-backfill`, `kb-index-map`, `kb-ingest-document`, `kb-intake-analyze`, `kb-promoter`, `kb-supervisor`
- **process** (4): `process-ai-import`, `process-download-job`, `process-email-queue`, `process-inbound-enrichment`
- **prompt** (3): `prompt-copilot-chat`, `prompt-registry-drift-check`, `prompt-test-runner`
- **save** (7): `save-correction-memory`, `save-linkedin-cookie`, `save-linkedin-credentials`, `save-ra-cookie`, `save-ra-prospects`, `save-wca-contacts`, `save-wca-cookie`
- **send** (3): `send-email`, `send-linkedin`, `send-whatsapp`
- **tmwe** (9): `tmwe-catalog-sync`, `tmwe-customer-sync`, `tmwe-disconnect`, `tmwe-oauth-callback`, `tmwe-oauth-start`, `tmwe-partner-link`, `tmwe-partner-match`, `tmwe-proxy`, `tmwe-quote-lookup`
