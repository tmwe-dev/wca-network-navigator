---
name: Persona-Aware Routing Rules
description: Tabella agent_routing_rules + tab Prompt Lab "Routing" + integrazione classify-email-response. Regole DB per persona (o globali) che fanno bias pre-classificazione (hint dominio/categoria/tono) e override post-classificazione (next lead_status, action_type, confidence floor, skip-action). Persona-specifiche battono globali.
type: feature
---
- DB: `agent_routing_rules` con match condizioni (domain/category/sentiment/lead_status/min_confidence/keywords), bias hints (domain/category/tone/extra_instructions) e override (next_status/action_type/priority/confidence_floor/skip_action). Telemetria match_count + last_matched_at via RPC `increment_routing_rule_match`. RLS: SELECT global (visibilità operatori), write user-scoped.
- Loader: `supabase/functions/_shared/agentRoutingRules.ts` esporta `loadRoutingRules`, `renderRoutingBiasBlock`, `findMatchingRule`, `buildOverride`, `recordRuleMatch`. Soft-fail su errori DB.
- Integrato in: `classify-email-response/index.ts` accetta `agent_id` opzionale; il bias block viene appeso a promptInstructions; post-classification l'override applica confidence_floor, sostituisce next_status (battendo `getNextStatus` hardcoded) o salta l'azione. Match registrato best-effort. Risposta include `routing_rule: {id,name,agent_id}`.
- UI: `src/v2/ui/pages/prompt-lab/tabs/AgentRoutingTab.tsx`, registrata in gruppo Strategy (icon Route). DAL `src/data/agentRoutingRules.ts`. QueryKey `queryKeys.agents.routingRules()`.
- Sicurezza: override del lead_status passa SEMPRE per `applyLeadStatusChange` (lead-status-guard); hard guards inalterati.
