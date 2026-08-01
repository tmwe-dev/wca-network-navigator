---
name: AI Cost Control & Deep Mail Gate
description: Controllo costi AI - gate analisi mail profonda OFF di default, remap modelli flash su gpt-4o-mini, interceptor token con SSE usage.
type: feature
---
- **Deep mail analysis OFF di default**: scout mittente (web) + inbound enrichment partono solo se app_setting `ai_deep_mail_analysis_enabled = "true"`. Gate in `_shared/deepMailAnalysis.ts`, applicato in check-inbox/check-inbox-booking `enqueueEnrichment.ts` e in `classify-inbound-message/stages/stageFunnemailPipeline.ts`. La classificazione base resta sempre attiva.
- **Model map (aiGatewayConfig.ts)**: i modelli "flash" mappano su `gpt-4o-mini` (NON gpt-4o, ~16x più caro). `google/gemini-2.5-pro` mappa su `gpt-4o`. gpt-5 resta gpt-4o.
- **Token tracking**: `_shared/llmFetchInterceptor.ts` inietta `stream_options.include_usage` sulle richieste stream e parsa l'usage dai chunk SSE; attribuisce la funzione reale saltando i frame `_shared`. Log in `ai_prompt_log`.
- **UI**: pannello `CostControlPanel` (toggle deep mail + consumi giornalieri) è la PRIMA tab di AI Control Center (`/v2/intelligence/control`).
