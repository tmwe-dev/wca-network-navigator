## PR-2 — Extension Auth Hardening + Cookie WCA/RA/LinkedIn user-scoped

Obiettivo: chiudere i 3 P0 ancora aperti su credenziali ed estensioni **senza toccare il flusso di login utente** (AuthProvider, useAuthV2, whitelist `authorized_users`, JWT locale, no `getUser()` di rete).

### Vincoli intoccabili (CODEX + memoria progetto)
- Auth utente: email+password con whitelist, NO Google, NO re-check whitelist su restore sessione, NO `getUser()` per validare JWT. Nessun file in `src/providers/AuthProvider.tsx`, `src/v2/hooks/useAuthV2.ts`, `useRequireAuth.ts`, `src/integrations/supabase/client.ts` viene modificato.
- `check-inbox`, `email-imap-proxy`, `mark-imap-seen`: NON toccare.
- Soft-delete trigger: nessun DELETE fisico.
- Loader prompt operativi e charter AI: invariati.

### Scope PR-2 (3 sotto-step atomici)

#### Step A — `extensionAuth.ts`: rimuovere fallback anon-key
File: `supabase/functions/_shared/extensionAuth.ts`
- Mantenere solo due percorsi validi:
  1. `Authorization: Bearer <user JWT>` → validato con `supabase.auth.getClaims(token)`; ritorna `{ userId, role: "user" }`.
  2. `x-extension-key: <SERVICE_ROLE>` (header dedicato, non `apikey`) → ritorna `{ userId: body.user_id (richiesto), role: "service" }`.
- Rifiutare esplicitamente qualunque token uguale a `SUPABASE_ANON_KEY` (401 `EXT_ANON_REJECTED`).
- Invariato: header CORS, struttura risposta, log strutturato.
- Test Deno: 4 casi (anon → 401, JWT valido → ok, service-role senza body.user_id → 400, service-role con body.user_id → ok).

#### Step B — Cookie WCA/RA/LinkedIn user-scoped
Migration:
- Tabelle nuove `user_wca_sessions`, `user_ra_sessions`, `user_linkedin_sessions` con `(user_id pk, cookie text, updated_at, expires_at)`.
- RLS: `auth.uid() = user_id` SELECT/INSERT/UPDATE; service-role bypass.
- Nessuna modifica a `app_settings` esistente (retro-compat lettura come fallback solo per migration grace period).

Edge functions toccate (solo cookie I/O, nessun cambio di logica business):
- `save-wca-cookie`, `save-ra-cookie`, `save-linkedin-cookie` → upsert nella tabella user-scoped del caller (richiede user JWT, no service-role).
- `get-wca-cookie`, `get-ra-cookie`, `get-linkedin-cookie` → lettura per `userId` (JWT o service-role+body.user_id).
- `wcaCookieStore.ts` (helper `_shared`): leggere prima `user_wca_sessions[user_id]`, fallback `app_settings` legacy per 1 release.

Frontend: `src/lib/wcaCookieStore.ts` invariato (è solo cache in-memory + localStorage del cookie già ricevuto). Nessun cambio a `useAuth*`.

#### Step C — Niente password/cookie in chiaro al browser
- `get-wca-credentials`, `get-ra-credentials`, `get-linkedin-credentials`:
  - Rimuovere il campo `password` dal payload di risposta.
  - Risposta nuova: `{ email, has_password: boolean, last_login_at }`.
  - Mantenere endpoint per UI "ho già configurato l'account?".
- Nuovi endpoint server-side `wca-login-internal`, `ra-login-internal`, `linkedin-login-internal`:
  - Accettano solo service-role + `user_id`, oppure user JWT (login per sé stesso).
  - Eseguono il login lato server e scrivono nella tabella `user_*_sessions` corrispondente.
  - Restituiscono solo `{ ok: true, expires_at }` — mai cookie o password al client.
- I chiamanti attuali (cron, agent, extension popup) passano dal nuovo endpoint.

### File toccati (lista chiusa)
```text
NEW  supabase/migrations/<ts>_user_scoped_extension_sessions.sql
EDIT supabase/functions/_shared/extensionAuth.ts
NEW  supabase/functions/_shared/extensionAuth_test.ts
EDIT supabase/functions/save-wca-cookie/index.ts
EDIT supabase/functions/save-ra-cookie/index.ts
EDIT supabase/functions/save-linkedin-cookie/index.ts
EDIT supabase/functions/get-wca-cookie/index.ts        (se esiste, altrimenti NEW)
EDIT supabase/functions/get-ra-cookie/index.ts
EDIT supabase/functions/get-linkedin-cookie/index.ts
EDIT supabase/functions/get-wca-credentials/index.ts
EDIT supabase/functions/get-ra-credentials/index.ts
EDIT supabase/functions/get-linkedin-credentials/index.ts
NEW  supabase/functions/wca-login-internal/index.ts
NEW  supabase/functions/ra-login-internal/index.ts
NEW  supabase/functions/linkedin-login-internal/index.ts
EDIT supabase/functions/_shared/wcaCookieStore.ts      (se presente)
```
NON toccati: AuthProvider, useAuthV2, useRequireAuth, supabase/client.ts, check-inbox, email-imap-proxy, mark-imap-seen, agent-execute, ownership.ts (già fatto in PR-1).

### Test e validazioni
- Deno test: extensionAuth (4 casi), nuovi endpoint login-internal (smoke).
- Vitest: `src/test/contracts.edge-auth.test.ts` aggiunto caso `save-wca-cookie` con anon-key → 401.
- Manuale: utente A salva cookie WCA → utente B chiama `get-wca-cookie` → riceve 404 (non più cookie di A).
- Auth utente: login email+password resta verde (nessun file auth modificato).

### Rollback
- Ogni endpoint mantiene il vecchio path attivo dietro feature flag `ENABLE_USER_SCOPED_SESSIONS` (default ON in dev, gating su prod).
- Migration reversibile: tabelle `user_*_sessions` indipendenti, drop senza impatto su `app_settings`.
- Trigger di rollback: auth error rate > 2%, 403 sui nuovi endpoint > 5%, errori cookie > 5% in 10 min.

### Cosa NON faccio in questa PR
- PR-3/4/5+ (internal contracts, drainer lock, providers, diagnostics, PWA, redaction, CI). Resto della roadmap immutata e già approvata, eseguita una PR alla volta dopo verifica.

Conferma per procedere con esecuzione di PR-2 in questo ordine: A → B → C, ciascuno con test prima di passare al successivo.