
## Stato attuale (cosa già esiste)

Lo step 1 server-side è già completato nella scorsa iterazione:

- `tmwe-oauth-callback` riceve il `code` dopo l'autenticazione TMWE esistente.
- Scambia il code per `access_token` TMWE (token esistente, mai esposto al client).
- Chiama `GET /erp/tmwe_json/get_my_profile` con `Authorization: Bearer {token}`.
- Estrae l'email autoritativa dal profilo, la **normalizza** (`trim().toLowerCase()`).
- Rifiuta gli alias `@tmwe.local`.
- Chiama `is_email_authorized(p_email)` (RPC che legge `authorized_users.is_active=true`).
- Se non whitelisted → redirect `/v2/login?tmwe=error&reason=not_whitelisted` **senza** creare utente Lovable né salvare token.
- Se autorizzato → crea/risolve l'utente Lovable, salva token TMWE in `tmwe_user_tokens` (service-role only) e genera magic link → sessione Supabase.

`LoginPage` mostra già solo il pulsante "Entra con TMWE" e mappa i `reason` in messaggi italiani (incluso `not_whitelisted`).

## Cosa manca per chiudere lo step 1

Il flusso autoritativo è in piedi, ma sopravvivono **entry-point legacy email/password** in `useAuthV2` e nelle route. Vanno **scollegati** (non ancora rimossi del tutto, come chiesto) per impedire qualunque accesso che bypassi il gate `get_my_profile + whitelist`.

## Piano di intervento (minimo, locale, reversibile)

### 1. `src/v2/hooks/useAuthV2.ts`
Trasformare gli action legacy in **no-op che restituiscono errore esplicito**, mantenendo la firma per non rompere chiamanti residui:

- `signInWithEmail` → setta `error = "Login email/password disabilitato. Usa Entra con TMWE."` e ritorna.
- `signUp` → idem.
- `resetPassword` / `updatePassword` → idem.

In questo modo nessun codice residuo può creare sessioni che bypassano la whitelist, ma la API del hook resta stabile (zero rischio di rompere import). I tipi e i nomi sono preservati.

### 2. Route legacy (`src/v2/routes.tsx` + `src/App.tsx`)
- In `V2Routes`: la route `reset-password` → redirect a `/v2/login` (rimosso il render di `ResetPasswordPage`, l'import lazy va eliminato).
- In `App.tsx`: il `LegacyRedirect` `/reset-password → /v2/reset-password` resta (atterra comunque su `/v2/login` per la regola sopra).
- `ResetPasswordPage.tsx` **non viene cancellato** (codice legacy preservato come da vincolo "non eliminare ancora tutto il legacy").

### 3. Centralizzazione del gate
Il gate è **già centralizzato server-side** in `tmwe-oauth-callback` (un solo punto di verità: profilo TMWE + whitelist). Sul client la sorgente unica per lo stato auth resta `AuthProvider` + `useAuthV2`. Non si introducono nuovi hook: il vincolo è "intervento minimo".

Stati già coperti dal flusso end-to-end:
| Stato | Dove |
|---|---|
| autenticazione in corso | `AuthProvider.status === "loading"` |
| token assente | `tmwe-oauth-callback` `missing_params` / `invalid_state` |
| caricamento profilo | fetch `get_my_profile` nel callback |
| profilo caricato | continua il flusso |
| email mancante | `reason=no_tmwe_email` su `/v2/login` |
| email non in whitelist | `reason=not_whitelisted` su `/v2/login` |
| utente autorizzato | magic link → sessione Supabase → `/v2/command` |
| errore get_my_profile | `reason=profile_fetch_failed` su `/v2/login` |

L'unica aggiunta UI: estendere `REASON_MESSAGES` in `LoginPage.tsx` con `profile_fetch_failed` e `whitelist_check_failed` (oggi cadono nel fallback generico).

### 4. Fuori scope (per restare minimi)
- Nessuna modifica a DB, RLS, edge functions, endpoint TMWE, struttura `authorized_users`.
- Nessuna modifica al flusso magic link / `AuthCallbackPage`.
- Nessuna rimozione fisica di `ResetPasswordPage`, `signInWithEmail` body, RPC.

## File toccati (3)

1. `src/v2/hooks/useAuthV2.ts` — neutralizza le 4 action legacy (no-op + error message).
2. `src/v2/routes.tsx` — rimuove l'import lazy di `ResetPasswordPage` e sostituisce la route con redirect a `login`.
3. `src/v2/ui/pages/LoginPage.tsx` — aggiunge 2 messaggi a `REASON_MESSAGES`.

## Test post-modifica

1. **Login OK**: utente con email in `authorized_users` → click "Entra con TMWE" → callback → magic link → atterra su `/v2/command`.
2. **Whitelist deny**: utente TMWE valido ma email non in `authorized_users` → redirect a `/v2/login?tmwe=error&reason=not_whitelisted` con messaggio chiaro, **nessun** record creato in `auth.users` né in `tmwe_user_tokens`.
3. **Profilo fail**: token TMWE invalido (simulato) → `reason=profile_fetch_failed` mostrato in italiano.
4. **Legacy bloccato**: chiamata diretta a `signInWithEmail("x","y")` da console → restituisce error "disabilitato", nessuna sessione creata.
5. **Route legacy**: visita manuale `/v2/reset-password` → redirect immediato a `/v2/login`.
6. **Sessione esistente**: utente già loggato non viene buttato fuori (nessuna re-check whitelist al restore session, comportamento già garantito da `useAuthV2`).
7. **Nessun log sensibile**: `console.log` esistenti non emettono token o password (verificato leggendo callback).

## Prossimo step sicuro (NON in questo intervento)

- Rimuovere fisicamente `ResetPasswordPage.tsx`, `ROUTE_RESET_PASSWORD`, e i body delle 4 action neutralizzate.
- Sostituire in `tmwe-oauth-callback` la `listUsers({perPage:200})` con lookup deterministico per email (hardening per workspace > 200 utenti).
- Considerare la rimozione della tabella `authorized_users` a favore di un check basato su un attributo del profilo TMWE (se mai disponibile).
