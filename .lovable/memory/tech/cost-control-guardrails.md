---
name: Cost Control Guardrails
description: Sistema interno aziendale → rate limit e budget AI/TTS DISATTIVATI di default; kill-switch via AI_USAGE_LIMITS_ENABLED per riattivarli in scenario commerciale futuro
type: constraint
---

## Stato corrente: USO INTERNO AZIENDALE

I limiti di costo (rate limiting per-isolate e budget giornalieri AI/TTS) sono **disattivati di default**. Le API si usano liberamente.

## Kill-switch

Variabile d'ambiente unica controlla tutti i gate:

- **Server**: `AI_USAGE_LIMITS_ENABLED` (Deno env)
- **Client**: `VITE_AI_USAGE_LIMITS_ENABLED`

Default: `false` → bypass totale.
Per riattivare in scenario commerciale: settare entrambe a `"true"`.

## Punti di bypass implementati

1. `supabase/functions/_shared/rateLimiter.ts` → `checkRateLimit` ritorna sempre `{ allowed: true, remaining: 999 }`.
2. `supabase/functions/_shared/costGuardrail.ts` → `checkDailyBudget` ritorna sempre `{ allowed: true, ... }` con cap = `Number.MAX_SAFE_INTEGER`.
3. `supabase/functions/consume-credits/index.ts` → ritorna sempre `{ allowed: true, byok: false, credits_consumed: 0 }`.
4. `supabase/functions/ai-assistant/index.ts` → gate `credits.balance <= 0` ignorato se flag off.
5. `src/lib/api/costTracker.ts` → `checkBudget()` no-op; `trackCost()` continua a tracciare per analytics ma non blocca.

## Cosa NON è bypassato (mai)

- **Hard guards di sicurezza** (`hardGuards.ts`): NO DELETE, NO bulk > 5, NO auth tables. Restano sempre attivi: sono **sicurezza**, non costo.
- Schema DB tabelle `user_credits`, `credit_transactions`, `usage_daily_budget`: preservate per analytics.
- Funzione DB `deduct_credits`: preservata (chiamata diventa no-op).

## Riattivazione futura

Quando si decide di commercializzare:
1. Settare `AI_USAGE_LIMITS_ENABLED=true` come secret edge function.
2. Settare `VITE_AI_USAGE_LIMITS_ENABLED=true` nel build env.
3. Tutto il codice di gate è preservato e torna operativo immediatamente.
