# Sprint Hardening Sicurezza + Affidabilità

Baseline: piano Claude (audit indipendente 76.400/100k). Innesto due interventi zero-rischio dal piano precedente (holding SSOT, CSP). Escludo riattivazione rate limiter (policy interna conferma OFF) e T5 unified tool loop (troppo invasivo, rinviato a sprint dedicato).

## Obiettivi
- Chiudere le 3 vulnerabilità P0 confermate da entrambi gli audit.
- Rendere la CI un gate vero, non informativo.
- Eliminare due fonti di drift note (costanti holding sparse, CSP assente).

## Interventi (in ordine di esecuzione)

### 1. Auth `mission-executor` (P0)
Aggiungere validazione JWT via `getClaims()`. Estrarre `user_id` dal token, mai dal body. Rifiutare 401 se header Authorization mancante o invalido. Mantenere service-role client solo per le operazioni interne dopo validazione utente.

### 2. Cron secret `smart-scheduler` (P0)
Endpoint chiamabile solo da pg_cron o admin autenticato. Aggiungere secret `SCHEDULER_CRON_SECRET` da verificare via header `x-cron-secret`. In alternativa accettare anche JWT admin (`has_role(uid,'admin')`). Aggiornare la chiamata pg_cron per passare il secret.

### 3. Idempotency atomica `send-email` (P0)
Migrazione: aggiungere `UNIQUE (idempotency_key, recipient_email)` su `email_campaign_queue`. Sostituire pattern `SELECT maybeSingle + INSERT` con `INSERT ... ON CONFLICT DO NOTHING RETURNING id`. Se conflitto, rispondere `{ cached: true, queue_id: existing }`. Test concorrenza: 5 invii paralleli stessa key → 1 sola riga, 4 cached.

### 4. Holding pattern SSOT (zero rischio)
Audit dei file di test e helper che ripetono i literal `"first_touch_sent"`, `"holding"`, `"engaged"`, `"qualified"`. Sostituire tutto con import da `@/constants/holdingPattern`. Aggiungere test di consistenza che fallisce se compaiono literal hard-coded fuori dal file SSOT.

### 5. CSP headers (hardening basso costo)
Estendere `_shared/securityHeaders.ts` con `Content-Security-Policy-Report-Only` (default-src 'self', script-src 'self' 'unsafe-inline' supabase, connect-src supabase + lovable AI gateway, img-src 'self' data: blob:, frame-ancestors 'none') e `Permissions-Policy` restrittiva. Deploy in Report-Only per 48h, poi promozione a enforce in sprint successivo (fuori scope).

### 6. CI hardening (P0)
In `.github/workflows/ci.yml`:
- Rimuovere `|| true` da `npm audit`, lint pubblico, typecheck pubblico, E2E.
- Promuovere security audit a bloccante con `--audit-level=high`.
- Mantenere E2E `continue-on-error` solo per la PRIMA PR di adozione, poi bloccante.

## Esclusioni esplicite
- **Rate limiter**: resta OFF per uso interno (policy `cost-control-guardrails`). Nessuna modifica.
- **T5 Unified tool loop**: nodo critico (orchestratori AI), richiede sprint dedicato con mappa impatto.
- **Voice-bridge fallback (T7)**: rinviato, nessun incidente noto.
- **Riduzione `as any` (T11)** e **coverage 40% (T12)**: backlog, non bloccanti per questo sprint.
- **check-inbox**: confermato escluso come da tua indicazione.

## Ordine e dipendenze
```
[1 Auth mission-executor]  ─┐
[2 Cron secret smart-sched]─┼─► [6 CI hardening] ─► merge fase 1
[3 Idempotency send-email] ─┘                          │
                                                       ▼
                                  [4 Holding SSOT] + [5 CSP Report-Only]
```
1, 2, 3 in parallelo. 6 dopo per non bloccare i fix con CI già stretta. 4 e 5 in parallelo come chiusura.

## Verifiche per dichiarare "fatto"
- `mission-executor`: chiamata senza JWT → 401; con JWT valido → 200, user_id dal token.
- `smart-scheduler`: chiamata senza secret/JWT admin → 401; cron pg passa secret → 200.
- `send-email`: 5 invii concorrenti stessa idempotency_key → 1 inserito, 4 `cached:true`, RPC `increment_partner_interaction` invocata 1 sola volta.
- Test holding: nessun literal fuori da `constants/holdingPattern.ts` (regex test).
- CSP: header presente in response edge functions, pagina app non genera violazioni in console (Report-Only).
- CI: PR con `as any` aggiunto oltre baseline → fail; PR con audit high severity → fail.

## Memorie da aggiornare a fine sprint
- `mem://tech/idempotency-atomic-pattern` (nuova)
- `mem://security/csp-policy` (nuova, Report-Only phase)
- `mem://security/edge-function-auth-guards` (estendere con mission-executor + smart-scheduler)
- `mem://reference/sprint-hardening-2026-05-08` (nuova, snapshot esecuzione)

## Stima
~2-2.5 giorni totali. Tutti gli interventi sono locali, reversibili, senza refactor opportunistici.
