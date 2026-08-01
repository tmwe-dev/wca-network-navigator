# AI Invocation Charter

**Versione:** 1.0 — 2026-04-28
**Status:** ENFORCED (block + ESLint + CI audit)

Regole inviolabili per ogni chiamata a edge function AI dal frontend.
Violazione = bug critico (allucinazione, fuori-strategia, fuori-DB).

---

## R1 — Scope obbligatorio

Ogni invocazione AI **DEVE** dichiarare uno `scope` registrato in
`public.ai_scope_registry`. Senza scope la richiesta viene rifiutata
lato edge con `400 missing_scope`.

Scope validi: `home | partners | missions | outreach | crm | staff |
strategic | command | email | classify | agent | sherlock | lab |
diagnostics | briefing`.

## R2 — Context obbligatorio

Ogni invocazione **DEVE** passare `context: { source, route?, mode? }`
per tracciabilità nell'audit log (`ai_invocation_audit`).

## R3 — Gateway unico (frontend)

`src/lib/ai/invokeAi.ts` è l'**unico** entry point ammesso.
È vietato chiamare direttamente `supabase.functions.invoke(...)` o
`invokeEdge(...)` per funzioni AI (vedi `AI_FUNCTION_NAMES`).
ESLint blocca le violazioni (`no-direct-ai-invoke`).

## R4 — Grounding ibrido

Per scope con `enforcement_mode = 'block'` e `requires_grounding =
true`, l'edge function AI:
- ottiene `tools` dal sistema e li espone al modello;
- se la query menziona entità (partner, paese, contatto, mission) e
  il modello risponde **senza chiamare alcun tool**, la risposta
  viene **bloccata** (`409 grounding_required`).

Per scope `warn`, la risposta passa ma viene marcata
`grounded: false` nell'audit log.

## R5 — System prompt fisso

Il system prompt include sempre la direttiva:
> "Per ogni domanda che menzioni entità presenti nel database
>  (partner, paesi, lead, mission, campagne) DEVI chiamare il tool
>  appropriato PRIMA di rispondere. Vietato inventare dati."

## R6 — Audit

Ogni invocazione viene loggata in `ai_invocation_audit` con
`scope, function_name, grounded, tool_calls_count, blocked,
block_reason`.

## R7 — Allowed tools per scope

`ai_scope_registry.allowed_tools` (opzionale) restringe i tool
disponibili per scope. Default: nessuna restrizione.

## R8 — CI gate

- `scripts/audit-ai-invocations.ts` fallisce la build se trova
  invocazioni dirette a edge function AI.
- ESLint rule `no-direct-ai-invoke` blocca i PR.

---

## Mapping scope → funzioni AI

| Scope | Edge functions tipiche |
|-------|------------------------|
| home | ai-assistant |
| partners | ai-assistant |
| missions | unified-assistant, ai-assistant |
| outreach | generate-outreach, generate-email, improve-email, ai-assistant |
| crm | ai-assistant, calculate-lead-scores |
| staff | ai-assistant |
| strategic | ai-assistant |
| command | ai-assistant |
| email | generate-email, improve-email |
| classify | classify-email-response, classify-inbound-message, categorize-content |
| agent | agent-execute, agent-loop, agent-simulate, agent-prompt-refiner |
| sherlock | sherlock-extract, agentic-decide |
| lab | prompt-test-runner, agent-simulate |
| diagnostics | ai-assistant |
| briefing | daily-briefing |

## Esempio di uso

```ts
import { invokeAi } from "@/lib/ai/invokeAi";

const reply = await invokeAi("ai-assistant", {
  scope: "home",
  messages: [{ role: "user", content: userText }],
  context: { source: "HomeAIPrompt", route: "/v2", mode: "tool-decision" },
});
```