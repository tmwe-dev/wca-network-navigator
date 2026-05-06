
# Audit autenticazione, profilo TMWE e whitelist

Solo analisi: nessuna modifica di codice, DB, endpoint o struttura whitelist.

## 1. Mappa del flusso di autenticazione attuale

```
[LoginPage /v2/login]
  └── bottone "Entra con TMWE"
       └── tmweLoginStart()  →  edge fn `tmwe-oauth-start` (intent=login)
             └── redirect a TMWE (sandbox.findair.net OAuth)
                  └── TMWE → callback `tmwe-oauth-callback`
                        ├── scambia code → access_token + refresh_token
                        ├── GET /erp/tmwe_json/get_my_profile  (Bearer access_token)
                        ├── estrae email, tmwe_user_id, company…
                        ├── *** NIENTE whitelist check ***   ← oggi disattivata
                        ├── trova/auto-crea utente Supabase (admin.createUser)
                        ├── upsert tmwe_user_tokens (token salvati server-side)
                        └── genera magic link → /v2/auth-callback → sessione Supabase
[AuthProvider]
  └── onAuthStateChange → JWT locale validato, no getUser() di rete
[useAuthV2]
  └── consuma session/user + carica profile + roles
```

Sorgenti:
- `src/v2/ui/pages/LoginPage.tsx`
- `src/data/tmwe.ts` → `tmweLoginStart`, `tmweGetMyProfile`, `tmweConnectStart`, `tmweDisconnect`
- `supabase/functions/tmwe-oauth-start/index.ts`
- `supabase/functions/tmwe-oauth-callback/index.ts`
- `supabase/functions/_shared/tmweClient.ts` (refresh + storage token)
- `supabase/functions/tmwe-proxy/index.ts` (canale unico verso TMWE)
- `src/providers/AuthProvider.tsx`, `src/v2/hooks/useAuthV2.ts`
- Memorie: `mem/auth/tmwe-only-auth-2026-05-05.md`, `mem/auth/no-whitelist-2026-05-05.md`

## 2. Mappa recupero profilo `get_my_profile`

Oggi viene chiamato **una sola volta**, dentro `tmwe-oauth-callback` (riga 118), subito dopo lo scambio code→token. Il token TMWE non viene mai esposto al browser:
- token salvato in `tmwe_user_tokens` (service role)
- chiamate runtime passano da `tmwe-proxy` che reidrata il token dal DB e lo refresha via `tmweClient.fetchWithToken`

Forma osservata del payload (per `firstString` nel callback):
- top-level: `id|user_id|tmwe_user_id|uid|userId|username`, `email`, `username`, `company|company_name|enterprise_name`, `vat_number|piva`, `name`
- nested possibile: `user.{id,user_id,username,email,company}`
- nested possibile: `data.{id,user_id,username,email,company}`

Conseguenza: la **email autoritativa** è `profile.email ?? user.email ?? data.email` (vedi righe 149-151). Se manca, oggi la callback fa fallback a `${username}@tmwe.local` per la modalità connect; per il **login** invece esce con `no_tmwe_email` (riga 162).

## 3. Mappa whitelist nei settings

Tabella DB: `authorized_users (id, email, display_name, is_active, last_login_at, login_count, created_at)`.

UI di gestione (CRUD):
- `src/v2/ui/pages/AdminUsersPage.tsx` (V2, attiva)
- `src/v2/ui/organisms/settings/SecuritySettingsTab.tsx` (V2, sola lettura)
- `src/components/settings/AdminUsersPanel.tsx` (legacy V1)
- `src/components/settings/TeamManagementPanel.tsx` (legacy V1)
- `src/components/settings/UserRolesPanel.tsx` (legacy V1)

Hook/RPC:
- `src/v2/hooks/useAdminUsersV2.ts` (lista/CRUD)
- `src/data/rpc.ts` → `rpcIsEmailAuthorized(email)` chiama RPC `is_email_authorized` (case-insensitive, `is_active=true`)

## 4. Punti in cui la email DEVE essere validata

Punto unico autoritativo (server, non bypassabile dal client):
- `supabase/functions/tmwe-oauth-callback/index.ts` — subito **dopo** aver letto `authEmail` da `get_my_profile` e **prima** di:
  - `admin.auth.admin.listUsers` / `admin.createUser`
  - upsert `tmwe_user_tokens`
  - generazione magic link

Comportamento atteso: se `rpc.is_email_authorized(authEmail.trim().toLowerCase()) === false` → `back("error", "not_whitelisted", "login")` SENZA creare utente Lovable né salvare token.

Punto secondario (UX non di sicurezza): nessuno. Il client non deve duplicare il check perché non vede mai l'email TMWE prima della sessione.

## 5. Vecchio codice email/password ancora presente

Nessuna UI lo espone più (LoginPage mostra solo TMWE), ma il codice è ancora referenziato:

- `src/v2/hooks/useAuthV2.ts`:
  - `signInWithEmail`, `signUp`, `resetPassword`, `updatePassword`
  - import `rpcIsEmailAuthorized`, `rpcRecordUserLogin`
- `src/v2/ui/pages/ResetPasswordPage.tsx` (route `/v2/reset-password`)
- Route legacy: `src/App.tsx` `/auth` e `/reset-password` redirectano a `/v2/login` e `/v2/reset-password`
- `src/components/auth/ProtectedRoute.tsx` → ancora redirige a `/auth`
- `src/v2/hooks/useRequireAuth.ts` → redirige a `/auth`
- `src/components/settings/*` legacy panels (V1)
- E2E: `e2e/smoke/01-auth-flow.spec.ts` testa form email/password

Nota: `useAuthV2` espone ancora le action di password per "compatibilità" (vedi memoria `tmwe-only-auth-2026-05-05`), ma nessun componente attivo le invoca.

## 6. Dipendenze legacy da scollegare

Ordinate per rischio crescente di rottura:

A. **Sicure da rimuovere subito** (zero call-site reali):
   - blocchi `signInWithEmail`/`signUp`/`resetPassword`/`updatePassword` in `useAuthV2`
   - pagina `ResetPasswordPage` + route `/v2/reset-password` + redirect `/reset-password`
   - test `e2e/smoke/01-auth-flow.spec.ts`

B. **Da unificare** (puntano ancora a `/auth`):
   - `ProtectedRoute` legacy → `/v2/login`
   - `useRequireAuth` → `/v2/login`
   - eventuali `navigate("/auth")` in `useAppNavigate`, `ConnectionBanner`, `AuthenticatedLayout`, `FloatingCoPilot`

C. **Settings duplicati** (V1 vs V2 sulla stessa tabella):
   - decidere se eliminare `AdminUsersPanel`/`TeamManagementPanel`/`UserRolesPanel` oppure dichiararli "in development" e nasconderli dalla nav. Memoria di progetto vieta cancellazioni di componenti V1 senza prova di non-uso → grep prima.

## 7. Rischi di collisione / accesso errato

1. **Whitelist disattivata oggi**: chiunque completi OAuth TMWE entra. Riattivare il gate è il fix di sicurezza prioritario.
2. **Email TMWE assente**: oggi se manca `email` nel profilo, il login fallisce; ok. Ma per `intent=connect` viene creato un alias `${username}@tmwe.local` → quell'alias non sarà mai in whitelist e va escluso anche per il path login.
3. **`tmwe_user_id` derivato da hash**: se TMWE non restituisce un id numerico, viene usato un FNV-1a su username. Se in futuro lo username cambia, l'utente risulterà "nuovo" (e quindi clash su email già esistente). Non è un problema oggi ma va annotato.
4. **Mismatch user.id vs email**: il sistema NON deve mai assumere `email == user_id`. Tutte le tabelle business usano `auth.users.id`. La whitelist usa `email`. Mantenere separati.
5. **listUsers paginated a 200**: in `tmwe-oauth-callback` la ricerca per email fa `listUsers({page:1, perPage:200})`. Se il workspace cresce sopra 200 utenti, un utente esistente potrebbe non essere trovato e verrebbe ricreato → conflitto sull'email. Da rimpiazzare con `getUserByEmail` o RPC dedicata.
6. **Token TMWE in DB**: già protetto da RLS + service role only (proxy). Non loggare mai `access_token`/`refresh_token`. Verificare `console.log` in `tmwe-oauth-callback` (oggi logga solo le chiavi del profilo, ok).
7. **Magic link**: generato lato server e seguito immediatamente dal browser. È un one-shot OTP — accettabile. Non finisce nei log applicativi.
8. **Email/messaggi/LinkedIn**: caricati dagli edge IMAP/WA/LI già scopati per `auth.uid()` via RLS. Non dipendono dal token TMWE. Nessuna azione richiesta.

## 8. Piano di migrazione in piccoli step (reversibili)

1. **Step 1 — Riattivare whitelist nel callback (server)**
   - In `tmwe-oauth-callback`, intent=`login`, dopo aver ricavato `authEmail`:
     - se `authEmail` non c'è o termina con `@tmwe.local` → `not_whitelisted`
     - chiamare `svc.rpc("is_email_authorized", { p_email: authEmail.trim().toLowerCase() })`
     - se false → `back("error", "not_whitelisted", "login")` SENZA creare utente né salvare token
   - Aggiornare memoria: `mem/auth/no-whitelist-2026-05-05.md` → sostituita da "whitelist attiva server-side nel callback".

2. **Step 2 — UI accesso negato chiara**
   - `LoginPage` già mappa `not_whitelisted`. Verificare che sia visibile e che non venga tentato auto-retry.

3. **Step 3 — Rimozione legacy email/password (no-op runtime)**
   - Cancellare `signInWithEmail`, `signUp`, `resetPassword`, `updatePassword` da `useAuthV2` e relativi import (`rpcIsEmailAuthorized`, `rpcRecordUserLogin`) → manteniamo `signOut`.
   - Eliminare `ResetPasswordPage` + route + redirect `/reset-password`.
   - Eliminare smoke test `01-auth-flow.spec.ts` (o rimpiazzarlo con uno che verifica solo la presenza del bottone TMWE).

4. **Step 4 — Unificare redirect a `/v2/login`**
   - `ProtectedRoute` legacy + `useRequireAuth` + ogni `navigate("/auth")` rimanente.
   - Mantenere `LegacyRedirect` `/auth → /v2/login` per link esterni.

5. **Step 5 — Settings panels duplicati**
   - Decidere V1 vs V2 (tenere V2). I V1 restano se ancora referenziati (memoria vieta cancellazioni alla cieca); altrimenti deprecare.

6. **Step 6 — Hardening minore**
   - Sostituire `listUsers({perPage:200})` con lookup deterministico per email.
   - Verificare RLS su `tmwe_user_tokens` (solo service role) e su `authorized_users` (solo admin RPC).
   - Confermare assenza di logging del token in tutto `_shared/tmweClient.ts`.

## 9. Primo intervento minimo consigliato

**Solo Step 1**: aggiungere il gate whitelist nel callback `tmwe-oauth-callback` per `intent=login`. È:
- una modifica chirurgica a un singolo file edge function,
- reversibile (commento o env flag `TMWE_WHITELIST_ENABLED`),
- chiude immediatamente il rischio di accesso non autorizzato,
- non tocca UI, hook, route, DB, schema, o gestione token.

Tutti gli altri step sono pulizia successiva, da fare uno alla volta.

## 10. Test necessari

Manuali (preview), nell'ordine:
1. **Login OK**: utente con email in `authorized_users.is_active=true` → entra in `/v2/command`, sessione attiva, `tmwe_user_tokens` popolata.
2. **Login negato**: utente TMWE valido ma email NON in whitelist → redirect `/v2/login?tmwe=error&reason=not_whitelisted`, nessuna riga creata in `auth.users` né `tmwe_user_tokens`, banner visibile.
3. **Login senza email TMWE**: account TMWE con `email` nullo → `reason=no_tmwe_email`, nessuna creazione.
4. **Token refresh**: chiamata a `tmwe-proxy` (es. `profile.me`) dopo > expires_in/2 → refresh trasparente, nuova `expires_at` in DB.
5. **get_my_profile dal browser**: verificare che il token TMWE NON sia in nessuna risposta visibile al client (solo wrapper proxy).
6. **API dati utente**:
   - email IMAP via `check-inbox` → solo righe dell'`auth.uid()` corrente
   - messaggi WA via bridge → solo dell'utente corrente
   - messaggi LinkedIn → idem
7. **Accesso negato dopo disattivazione**: admin disattiva `is_active=false` per Mario. Mario è già loggato → continua la sessione corrente (la whitelist è gate di login, non di runtime). Logout + login → bloccato. Documentare questo comportamento; se inaccettabile, aggiungere un trigger separato o un check in `/v2/auth-callback`.
8. **E2E** (dopo Step 3): aggiornare `08-v2-navigation.spec.ts` per partire da una sessione mockata; rimuovere `01-auth-flow`.

## Vincoli rispettati

- Nessuna modifica di endpoint, DB, struttura whitelist, API.
- Nessun secondo login email/password proposto.
- Token TMWE mai esposto al client, mai loggato.
- `email` non usata come user id.
- Codice legacy NON eliminato finché lo step relativo non lo confermerà non referenziato.
