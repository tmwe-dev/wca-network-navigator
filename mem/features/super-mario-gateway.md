---
name: Super Mario AI Gateway
description: Gateway AI unificato per Command (e scope futuri); KB statica+dinamica+situazionale, hard guards, audit redatto
type: feature
---
**Edge function**: `supabase/functions/super-mario/`
- `index.ts` — orchestrator (auth JWT locale, no getUser di rete)
- `identityLoader.ts` — DB `super_mario_identities` (cache 5min, fallback)
- `runtimeContract.ts` — schema risposta JSON + hard guards in chiaro per LLM
- `kbAssembler.ts` — KB 3 livelli: STATIC + DYNAMIC (filtrata per intent via keyword router) + SITUATIONAL
- `memoryAssembler.ts` — narrative summary versionato + recent 10 turns + last_tool_result + operator_memory
- `summarizer.ts` — `ensureSummaryCoverage` su `conversation_summaries`
- `toolCatalog.ts` — descrittori con `risk_level` (read/write/send/destructive)
- `preflightAudit.ts` — size cap 80k char, injection patterns
- `postflightAudit.ts` — JSON shape (`isSuperMarioResponse`)
- `hardGuards.ts` — sanitize: blocca destructive/unknown tools, forza needs_user_confirmation per write+
- `auditLogger.ts` — log redatto (SHA256 prompt, PII strip) → `super_mario_invocations` (retention 30gg via expires_at)

**DB**:
- `super_mario_identities` (scope unique, content, version)
- `conversation_summaries` (from/to_message_index + summary versionato)
- `super_mario_invocations` (trace_id, prompt hash, redacted, tool_calls_json, audit_warnings, error_code)

**Frontend**:
- `src/v2/ai/superMario.ts` — `invokeSuperMario({ source, userMessage, turns, ... })` via `invokeAi` (charter R1+R2)
- `src/lib/ai/invokeAi.ts` — `super-mario` aggiunto a `AI_FUNCTION_NAMES`
- `src/v2/ui/pages/command/tools/registry.ts` — `RiskLevel` + `riskLevel` su `ToolMetadata`; `SEND_TOOL_IDS` separato da `WRITE_TOOL_IDS`

**Cablaggio Command**: PENDING. Il client esiste, `useCommandSubmit` non lo usa ancora (per non rompere). Migrazione incrementale: feature flag → A/B → rimozione `useResultCommentary` e regex `aiBridge`.

**Scope KB dinamica**:
- email/outreach/whatsapp → contesti operative_prompts: email, email-quality, outreach, multi-channel, post-send, whatsapp
- partner-search → general
- agenda/general → general
- classification/commercial → classification, lead-status, outreach
