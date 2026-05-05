---
name: Inbound Enrichment Queue
description: Mail inbound da mittenti sconosciuti vengono accodate in inbound_enrichment_queue e classificate AI in background ogni minuto, con suggerimento mostrato sulle card Funnemail
type: feature
---
- check-inbox enqueue mittenti SCONOSCIUTI (dominio non in partners/partner_contacts, no free domains) in `inbound_enrichment_queue` (best-effort, no chiamate AI sincrone).
- Edge function `process-inbound-enrichment` (cron `* * * * *`, batch=5) chiama gemini-2.5-flash via callLLM, scrive `channel_messages.ai_classification_suggestion` (jsonb: category/reason/confidence/suggested_group/generated_at/model).
- UI: FunnemailMailList legge `ai_classification_suggestion` e passa label/reason a `AiSuggestionChip`.
- Default UI: vista=Non lette, sort=Azienda A-Z (`funnemail_list_view_v2`), pulsante "Letta" diretto sulla card. Auto-focus prima entità in EntityListWithDetail.
