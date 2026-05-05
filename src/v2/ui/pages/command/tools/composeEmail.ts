/**
 * compose-email tool — barrel.
 *
 * Refactor 2026-05-05: il monolite (1033 LOC) è stato suddiviso in moduli
 * focalizzati sotto `composeEmail/`. Questo file espone l'API pubblica
 * preservando gli import esistenti (registry + test).
 *
 * - composeEmail/types.ts          → tipi PartnerRow/ContactRow/aliases
 * - composeEmail/promptParse.ts    → parsing prompt (country, person, intent)
 * - composeEmail/partnerQueries.ts → query Supabase su partners/contacts
 * - composeEmail/pipeline.ts       → buildEmailPipeline (badge UI)
 * - composeEmail/batchDrafts.ts    → batch country-wide via generate-email
 * - composeEmail/singleDraft.ts    → singolo destinatario via generate-email
 * - composeEmail/executor.ts       → orchestrazione + match() + execute()
 */
export { composeEmailTool } from "./composeEmail/executor";
export { detectCountryCode, isCountryWideIntent } from "./composeEmail/promptParse";