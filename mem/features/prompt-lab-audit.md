---
name: Prompt Lab Audit
description: Tab Audit + edge function agent-audit che mostra per ogni agente cosa è DB (Prompt Lab) vs Hardcoded (codice), con diff capabilities, tool registry, persona, operative prompts e hard guards immutabili.
type: feature
---
- Edge function: `supabase/functions/agent-audit/index.ts` (GET, auth richiesta). Riusa `loadAgentPersona`, `loadAgentCapabilities` (DEFAULT_CAPABILITIES, READ_ONLY_TOOL_SET) e `loadOperativePrompts` per restituire diff per ogni agente attivo.
- UI: `src/v2/ui/pages/prompt-lab/tabs/AuditTab.tsx` registrata nel gruppo Strategy come tab "audit" (icon ScanSearch). Filtri "Tutti" / "Solo con override DB", refetch button.
- Diff per agente: System Prompt sections (identity/objective/session/persona/operative/footer con sorgente code/db/runtime), Capabilities table (default codice vs DB override), Tool registry (allowed/blocked/effective + approval hardcoded vs DB), Operative prompts caricati.
- Hard guards card sempre visibile: forbidden_tables, destructive_blocked, approval_always_required, bulk_caps con `editable: false`. Sorgente: `src/v2/agent/policy/hardGuards.ts`.
- DAL: `src/data/agentAudit.ts` (`fetchAgentAudit`). Query key: `queryKeys.agents.audit()`.
