
# Analisi del piano TMWE / findair v2

## Verdetto rapido

**Il piano è solido e production-ready al ~85%.** Architettura corretta, pattern allineati al progetto, smoke test API già fatti, scope MVP ben delimitato. Ci sono però **5 punti che vanno corretti o chiariti prima di scrivere una riga di codice**, perché tre di essi violano convenzioni del nostro progetto e due introducono rischi reali in produzione.

---

## Cosa è ottimo

- **Smoke test reali fatti** (20 anagrafiche, 11 indirizzi, 101 contatti, 50 listini verificati). Niente piano "su carta".
- **Pitfall URL `/erp/tmwe_json/<action>`** documentato — questo da solo evita un giorno di debug.
- **Token cache server-side** in `tmwe_oauth_token` con retry on 401: pattern corretto, niente token esposto al browser.
- **MVP delimitato** (anagrafica + contacts + listini), shipments/webhook in fase 2: scelta saggia.
- **Mapping partner ⇄ anagrafica opt-in** (`partners.tmwe_anagrafica_id` nullable): non rompe dati esistenti.
- **Bug noti TMWE elencati** con workaround (`/api_listini_assignments` 500, `/api_invoices` 403): trasparente.
- **Reuse di `_shared/cors.ts`, `handleEdgeError.ts`, `authGuard.ts`**: confermato che esistono nel progetto.

---

## Problemi da correggere PRIMA di implementare

### 1. CRITICO — Auth client errato in `_shared/tmweClient.ts`

Il pseudocodice usa `auth.getUser(token)` (riga implicita §3.1, esempio §5.1 punto 2). **Violazione diretta della Core Rule del progetto**: 

> "NO `getUser()` di rete per validare JWT" (mem://auth/working-auth-config-2026-04-15)

**Fix**: usare `getClaims()` come fanno tutti gli altri edge function (vedi `mem://security/hardening-and-isolation-v2`). Il piano va aggiornato per delegare la validazione JWT al pattern esistente di `authGuard.ts`, non a `getUser`.

### 2. CRITICO — `verify_jwt` non specificato per ogni funzione

Il config.toml del progetto ha **39 dichiarazioni `verify_jwt = false`** (tutte le edge functions sono marcate esplicite). Il piano dice "use `verify_jwt = true` for everything except `tmwe-webhook-receive`" ma l'auth è gestita applicativamente in tutto il progetto.

**Fix**: tutte le `tmwe-*` devono avere `verify_jwt = false` nel config.toml e validare JWT internamente con `requireAuth()` da `authGuard.ts` (coerente con il resto del progetto). Solo `tmwe-webhook-receive` resta `verify_jwt = false` con verifica HMAC.

### 3. ALTO — Frontend chiamerà `tmwe-token` direttamente (Settings card)

§7.3 dice: *"Refresh token (calls `tmwe-token` directly to force a re-fetch)"*. Ma §5 dice *"`tmwe-token` Internal — Not invoked from frontend"*. **Contraddizione interna.**

**Fix**: rimuovere il bottone "Refresh token" dalla UI (o farlo agire su `tmwe-status` con un flag `?force_refresh=true` che lato server invalida la cache). Mai esporre `tmwe-token` al browser.

### 4. ALTO — RLS della tabella `tmwe_anagrafica_cache` permissiva

```sql
CREATE POLICY tmwe_anagra_select ON public.tmwe_anagrafica_cache FOR SELECT USING (true);
```

Espone **tutte le anagrafiche TMWE** (P.IVA, codici fiscali, ragioni sociali) a qualsiasi utente autenticato. Anche se i dati provengono da un ERP aziendale, il principio del progetto è isolamento per operator (`mem://security/user-isolation-and-rbac-v2`).

**Fix**: usare lo stesso pattern delle "shared contacts" (`mem://business/shared-contacts-visibility-policy`) → visibilità globale ma SOLO ad utenti autenticati con check esplicito su `auth.uid() IS NOT NULL`. Oppure, meglio ancora, leggere sempre tramite Edge Function (no policy SELECT diretta) per audit centralizzato.

### 5. MEDIO — DAL bypass: tutte le `tmwe_*` table devono passare per `src/data/`

Il piano mette `api.ts` in `src/v2/integrations/tmwe/api.ts` con `invokeEdge` wrappers. **Va bene per le chiamate edge**, ma `tmwe_quotes` e `tmwe_shipments` saranno anche letti via Supabase client per la "Quote history list" (§7.4). 

**Fix**: aggiungere `src/data/tmweQuotes.ts` e `src/data/tmweShipments.ts` come previsto da `mem://architecture/data-access-layer-dal` ("DAL access only; no direct `supabase.from()` calls in UI/hooks"). Il piano non lo menziona.

---

## Raccomandazioni aggiuntive (non bloccanti)

### A. Rate limiting interno verso TMWE

Il piano non menziona limiti di chiamata. TMWE è un ERP esterno: una pagina che apre 5 partner = 5×3 chiamate parallele (anagrafica + addresses + contacts + banks). Aggiungere:
- **Throttle** (max N req/sec) nel `tmweClient.ts`
- **Cache TTL** su `tmwe_anagrafica_cache` (suggerito: 1h, configurabile) come fatto per WCA scraping (`mem://tech/automation/scraping-cache`)

### B. Soft-delete coerente

Il progetto ha **soft-delete globale** (trigger DB su 15 tabelle business, vedi `mem://constraints/no-physical-delete`). Le 4 nuove tabelle TMWE (`tmwe_quotes`, `tmwe_shipments`, `tmwe_webhook_events`, `tmwe_anagrafica_cache`) **devono** decidere se entrare nello stesso schema (`deleted_at` + trigger) o restare append-only. Per webhook events e cache: append-only va bene. Per quotes e shipments: soft-delete obbligatorio.

### C. Structured logging + edge metrics

Tutti gli edge function nuovi devono usare `_shared/structuredLogger.ts` e popolare `edge_metrics` (`mem://tech/structured-logger-and-edge-metrics`). Non menzionato nel piano.

### D. Connector vs custom integration

Il progetto ha l'**AI Invocation Charter** che impone tutte le chiamate AI passino da `invokeAi()`. TMWE non è AI, quindi non si applica — ma se domani volessimo usare un agente per generare quote automatiche (`tmwe-rate-lookup` chiamato da Luca), dovremo registrare lo scope in `ai_scope_registry` (`mem://architecture/ai-invocation-charter`).

### E. Webhook security (fase 2)

§5 menziona HMAC ma non dice come. Quando arriva la fase 2:
- Verificare `signature[]` con `crypto.subtle.verify` (lo standard del progetto)
- Salvare sempre l'evento in `tmwe_webhook_events` anche se HMAC fallisce, con `signature_ok=false`, per audit
- Idempotency su `tmwe_id + event_type` per evitare doppia processazione

### F. Generazione tipi TMWE

§10 ha 2 opzioni per `openapi-typescript`. Raccomando la "easy": commit del file generato con script manuale + nota nel README. La pipeline CI con secret/PR è over-engineering per un'integrazione single-tenant.

---

## Stima realistica e ordine

L'ordine in §8 è corretto. Stima onesta basata sui pattern esistenti:

| Fase | Effort |
|---|---|
| 1. Migration + shared client + token/status | 0.5–1 giorno |
| 2. Anagrafica list/detail + AnagraficaPicker | 1 giorno |
| 3. Listini list/detail + RateLookupForm | 1 giorno |
| 4. Settings card + Partner tab + UAT | 0.5 giorno |
| **Totale MVP** | **~3–3.5 giorni** |
| Fase 2 (shipments + webhook) | +2–3 giorni |

---

## Cosa serve da te per partire

1. **Conferma dei 5 fix** della sezione "Problemi da correggere".
2. I 4 secrets TMWE (BASE_URL, CLIENT_ID, CLIENT_SECRET; WEBHOOK_SECRET arriva in fase 2).
3. Conferma URL produzione (`erp.tmwe.it/erp/tmwe_json` — il piano lo segnala come "da confermare").
4. Decisione su soft-delete per `tmwe_quotes` e `tmwe_shipments` (raccomando: sì).

Una volta confermati questi punti, si può partire dalla migration. Tutto il resto del piano è applicabile così com'è.
