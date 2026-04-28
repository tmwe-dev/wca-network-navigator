---
name: Agent Capabilities DB Layer
description: Tabella agent_capabilities (1:1 con agents) controlla tool whitelist/blacklist, timeout, concorrenza, modello e modalità per agente; editabile dal Prompt Lab tab "Agent Capabilities"; enforcement in agent-loop via _shared/agentCapabilitiesLoader.ts. Hard guards di sicurezza restano sempre attivi e non bypassabili.
type: feature
---

## Tabella agent_capabilities
- 1:1 con `agents` (UNIQUE su agent_id, ON DELETE CASCADE)
- Trigger auto-crea riga di default ad ogni INSERT in `agents`
- Backfill per agenti esistenti già eseguito
- RLS: SELECT globale autenticati; INSERT/UPDATE/DELETE solo proprietario (allineato a `agent_personas`)

## Campi governati
- `allowed_tools`, `blocked_tools`, `approval_required_tools` (text[])
- `max_concurrent_tools` (1-25, default 3)
- `step_timeout_ms` (1000-120000, default 25000)
- `max_iterations` (1-50, default 12)
- `max_tokens_per_call` (100-16000, default 1500)
- `temperature` (0-2, default 0.20)
- `preferred_model` (es. google/gemini-2.5-flash; null=default funzione)
- `execution_mode`: `autonomous` | `supervised` (default) | `read_only`

## Enforcement runtime
- `supabase/functions/_shared/agentCapabilitiesLoader.ts`: loader + `filterToolsByCapabilities` + `READ_ONLY_TOOL_SET`
- `agent-loop` accetta `agentId` nel body; se passato carica capabilities, filtra tool, applica modello/temperature/max_tokens; restituisce `capabilities` nel response per il client
- Soft-fail: se DB non disponibile usa DEFAULT_CAPABILITIES, mai blocca

## UI
- Tab "Agent Capabilities" in Prompt Lab gruppo "strategy" (icona ShieldCheck)
- Hook `useAgentCapabilities` in `src/v2/ui/pages/prompt-lab/hooks/`
- DAL `src/data/agentCapabilities.ts` e `src/data/agentsForPromptLab.ts`
- Query keys: `queryKeys.agents.allForCapabilities()` e `queryKeys.agents.capabilities(id)`

## Vincoli
- Hard guards (`src/v2/agent/policy/hardGuards.ts`) NON sono bypassabili da capabilities
- Read-only mode interseca sempre con `READ_ONLY_TOOL_SET`
- Blacklist ha precedenza su whitelist
