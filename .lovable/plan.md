

## Obiettivo

Rimuovere completamente i limiti/credit gate dal sistema AI per uso aziendale interno. Le API si usano liberamente, senza budget, senza saldo, senza BYOK forzato. Quando si commercializzerà, si reintrodurranno i limiti via toggle.

## Esplorazione

Punti dove esiste un blocco/gate:
- `supabase/functions/ai-assistant/index.ts` — gate `credits.balance <= 0` (appena modificato)
- `supabase/functions/consume-credits/index.ts` — calcolo costi e `deduct_credits` RPC
- `supabase/functions/_shared/costGuardrail.ts` — `checkDailyBudget` / `budgetExceededResponse`
- `supabase/functions/_shared/rateLimiter.ts` — token bucket per-isolate
- `src/lib/api/costTracker.ts` — `checkBudget` client-side che lancia `BudgetExceededError`
- `src/hooks/useCredits.ts` — visualizza saldo
- Edge functions che importano `consumeCredits` / `checkDailyBudget` / `checkRateLimit` (da censire)

Memoria correlata: `mem://tech/cost-control-guardrails` e `mem://tech/billing-internal-credits` — vanno aggiornate per riflettere la nuova policy "uso libero interno".

## Strategia

Introduco un **kill-switch unico** invece di cancellare il codice (così è facile riattivarlo per la commercializzazione futura).

### Livello 1 — Edge functions

Variabile d'ambiente `AI_USAGE_LIMITS_ENABLED` (default: `false`).

Modifico in modalità "bypass quando disabled":
- `checkDailyBudget` → ritorna sempre `{ allowed: true, ... }` se flag off
- `checkRateLimit` → ritorna sempre `{ allowed: true, remaining: 999 }` se flag off
- `consume-credits` → ritorna sempre `{ allowed: true, byok: false, credits_consumed: 0, message: "uso interno illimitato" }` se flag off
- `ai-assistant` → rimuovo il gate `credits.balance <= 0` (sostituito con check del flag)

Tutte le altre edge functions che invocano queste utilities continuano a funzionare senza modifiche.

### Livello 2 — Client

- `costTracker.ts`: `checkBudget()` no-op quando flag off, `trackCost()` continua a tracciare per analytics ma non blocca mai
- Flag client: `VITE_AI_USAGE_LIMITS_ENABLED` (default: `false`)
- `useCredits` continua a leggere il saldo per visualizzazione, ma nessun componente lo usa più come gate

### Livello 3 — UI

- `AISettingsTab` (e altri pannelli con avvisi crediti): se flag off, nascondo banner "crediti esauriti / configura BYOK"
- Manteniamo il display del saldo come informazione, non come blocco

### Livello 4 — Memoria

Aggiorno `mem://tech/cost-control-guardrails` e `mem://tech/billing-internal-credits` per documentare:
- Sistema interno aziendale → limiti DISATTIVATI di default
- Toggle via env var per riattivare in scenario commerciale futuro
- Codice preservato, non rimosso

## File modificati

1. `supabase/functions/_shared/rateLimiter.ts` — bypass se flag off
2. `supabase/functions/_shared/costGuardrail.ts` — bypass se flag off
3. `supabase/functions/consume-credits/index.ts` — bypass se flag off
4. `supabase/functions/ai-assistant/index.ts` — rimuovo gate `balance<=0`
5. `src/lib/api/costTracker.ts` — `checkBudget` no-op se flag off
6. `src/v2/ui/organisms/settings/AISettingsTab.tsx` — nascondi avvisi limit (verifico se presenti)
7. Eventuali banner "crediti esauriti" nel layout (da censire)
8. `mem://tech/cost-control-guardrails` — aggiornata
9. `mem://tech/billing-internal-credits` — aggiornata
10. `mem://index.md` — aggiornata

## Cosa NON tocco

- Hard guards di sicurezza (`hardGuards.ts`): NO DELETE, NO bulk > 5, NO auth tables. Restano attivi sempre — sono sicurezza, non costo.
- Schema DB tabelle `user_credits`, `credit_transactions`, `usage_daily_budget`: restano (utili per analytics futuri).
- Funzione `deduct_credits` DB: resta (chiamata diventa no-op via flag).

## Verifica post-implementazione

1. LUCA risponde anche con `balance = 0`.
2. Edge function logs di `ai-assistant` → nessun blocco crediti.
3. `consume-credits` ritorna `allowed: true` senza scalare nulla.
4. UI: nessun banner "crediti esauriti" visibile.
5. Hard guards ancora attivi: tentativo DELETE da AI → bloccato.
6. Riattivazione test: settando `AI_USAGE_LIMITS_ENABLED=true` i limiti tornano funzionanti.

