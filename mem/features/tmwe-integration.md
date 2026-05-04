---
name: TMWE Integration (Findair Sandbox)
description: Edge function proxy server-side per TMWE; zero token nel client; mapping auth.users.id ⇄ tmwe_user_id via OAuth Authorization Code
type: feature
---
## Architettura
- Tre edge functions: `tmwe-oauth-start` (genera state CSRF + redirect URL), `tmwe-oauth-callback` (verify_jwt=false, scambia code→token, recupera profilo, persiste in `tmwe_user_tokens`), `tmwe-proxy` (unico canale di uscita verso TMWE).
- Whitelist deterministica `TMWE_OPS` in `_shared/tmweClient.ts`: profile.me, tracking.byAwb, shipment.list, shipment.unified, rubrica.search, system.health. Nuovi endpoint solo aggiungendoli qui.
- Token TMWE (system + user) restano sempre server-side. Il client riceve solo `{ ok, status, data, tmwe_user_id }`.

## Identità
- SSOT: `auth.users.id`. `tmwe_user_id` (bigint UNIQUE) è attributo in `tmwe_user_tokens`.
- 1 operatore Lovable ⇄ 1 account TMWE. Il callback rifiuta con `tmwe_account_already_linked` se la stessa cuenta TMWE viene connessa a un altro `user_id`.
- UI legge solo metadati via vista `tmwe_user_connections_v` (security_invoker, filtra per `auth.uid()`); tokens non esposti.

## Tabelle
- `tmwe_system_tokens` (singleton, service-role only)
- `tmwe_user_tokens` (PK user_id, UNIQUE tmwe_user_id, RLS deny-all, accesso solo via service role)
- `tmwe_oauth_state` (CSRF, TTL 5 min)
- `tmwe_proxy_audit` (operatore vede le proprie righe)

## Secrets
TMWE_BASE_URL, TMWE_SYSTEM_CLIENT_ID/SECRET, TMWE_OAUTH_CLIENT_ID/SECRET, TMWE_OAUTH_REDIRECT_URI.

## DAL
`src/data/tmwe.ts`: getTmweConnection, tmweGetMyProfile, tmweTrack, tmweListMyShipments, tmweUnifiedShipment, tmweRubricaSearch, tmweConnectStart, tmweDisconnect. Tutte usano `supabase.functions.invoke('tmwe-proxy'|'tmwe-oauth-start'|'tmwe-disconnect')`. Mai chiamare TMWE direttamente.

## Constraint
- Vietato esporre access_token/refresh_token TMWE al frontend.
- Vietato accettare `path` arbitrari nel proxy: solo `op` ∈ TMWE_OPS.
- `tmwe-oauth-callback` è l'UNICA edge function TMWE con `verify_jwt = false` (riceve callback browser senza JWT Lovable).
