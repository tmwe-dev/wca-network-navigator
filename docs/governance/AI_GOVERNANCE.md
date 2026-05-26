# AI Governance

Riferimento canonico: `docs/ai/AI_INVOCATION_CHARTER.md`.

## Principi
1. **Single entry point**: ogni chiamata AI frontend passa da `invokeAi()` con `scope` (registrato in `ai_scope_registry`) e `context.source`.
2. **No direct invoke**: ESLint rule `no-direct-ai-invoke` blocca `supabase.functions.invoke` diretto su edge AI.
3. **Hard guards** sempre attivi (anche con `AI_USAGE_LIMITS_ENABLED=false`):
   - no DELETE su tabelle business
   - bulk cap (max N record per operazione)
   - risk gate 7 livelli (`_shared/aiActionRiskGate.ts`)
   - prompt injection HIGH-block con `injectionGuard`
4. **Editorial review** obbligatorio su email/WA/LI (`journalistReview`). Eccezione: autoresponder template-only.
5. **Prompt versioning**: ogni modifica su `operative_prompts` snapshot immutabile in `prompt_versions`. Rollback via `rollback_prompt_to_version()`.
6. **Regression tests**: `prompt-test-runner` esegue casi in `prompt_test_cases`, log in `prompt_test_runs`.
7. **Audit log**: `ai_interaction_log` + `ai_message_feedback`, retention 90gg.

## Modelli supportati
Lovable AI Gateway: famiglie `google/gemini-*`, `openai/gpt-5*`. BYOK opzionale. Rate limit per scope.

## Personas e capabilities
Editabili da DB (`agent_personas`, `agent_capabilities`), hot-reload via `agent-loop`/`agent-execute` loaders. Simulator dry-run disponibile su `/v2/prompt-lab/simulator`.
