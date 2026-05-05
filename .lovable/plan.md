## Obiettivo

Eliminare il doppio sistema di autenticazione. Una sola porta d'ingresso: **TMWE OAuth**. La whitelist `authorized_users` resta il cancello finale: solo chi è dentro entra.

## Flusso target

```
/v2/login  →  [bottone "Entra con TMWE"]  →  TMWE OAuth
                                              │
                                              ▼
                                  tmwe-oauth-callback
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                                       ▼
                 email in whitelist?                   email NON in whitelist
                          │                                       │
                          ▼                                       ▼
                 crea/risolve utente Lovable             redirect /v2/login
                 magic link → /v2                        ?tmwe=error
                                                         &reason=not_whitelisted
```

Risultato: nessuna seconda password da gestire. L'admin gestisce gli accessi solo nella schermata operatori (whitelist).

## Modifiche

### 1. `tmwe-oauth-callback` (edge function) — gate whitelist

Subito dopo aver ricavato `authEmail` dal profilo TMWE, prima di creare/risolvere l'utente Lovable:

- Query su `authorized_users` (case-insensitive) per `authEmail`.
- Se non presente → `back("error", "not_whitelisted", "login")` che rimanda a `/v2/login?tmwe=error&reason=not_whitelisted`.
- Se presente → procedi (resolve/auto-create + magic link, come oggi).

Nessun'altra modifica al flusso OAuth: il behavior corrente di auto-creazione utente Lovable rimane identico, ma solo per email autorizzate.

### 2. `/v2/login` (LoginPage.tsx) — semplificare a solo TMWE

- Rimuovere stati `mode` (login/signup/forgot), `email`, `password`, `displayName`, `submitting`, `resetSent`.
- Rimuovere chiamate a `signInWithEmail`, `signUp`, `resetPassword`.
- Rimuovere il separatore "OPPURE" e tutti i form.
- Tenere solo:
  - Titolo / brand
  - Bottone "Entra con TMWE" (`handleTmweLogin`)
  - Banner errore se `?tmwe=error&reason=…` (incluso messaggio amichevole per `not_whitelisted`: *"Email non autorizzata. Contatta l'amministratore."*)

### 3. `useAuthV2` — disattivare azioni email

- Mantenere il hook (lettura sessione, profilo, ruoli, signOut).
- Le azioni `signInWithEmail`, `signUp`, `resetPassword`, `updatePassword` restano esportate per compatibilità ma non vengono più chiamate dalla LoginPage. Non rimuoverle ora (per evitare rotture in altri componenti come `SecuritySettingsTab`, `useAdminUsersV2`).
- Nessun cambio comportamentale lato sessione: l'AuthProvider funziona già con qualsiasi sessione valida (anche quella creata via magic link TMWE).

### 4. Settings whitelist — etichetta UI

Solo nella copy, dove le pagine settings parlano di "operatori autorizzati al login email": aggiornare il microcopy a *"Operatori autorizzati. Solo le email presenti qui possono entrare con TMWE."*

File coinvolti (solo testi, niente logica): `AdminUsersPage.tsx`, eventualmente `AdminUsersPanel.tsx`.

### 5. Pagine accessorie

- `/reset-password`: resta funzionante (può essere richiamata via link Supabase) ma non più linkata. Nessuna modifica codice.
- Eventuali link a "Crea account" o "Password dimenticata" rimossi insieme al form.

## Cosa NON cambia

- AuthProvider centralizzato e regole di restore sessione (memoria `working-auth-config`).
- `authorized_users` schema, RLS, RPC `is_email_authorized`.
- Auto-creazione utente Lovable nel callback TMWE (resta, ma gated).
- Magic link finale → `/v2` (rispetta lo stato `from` se in futuro vorremo passarlo).
- `tmwe-oauth-start` / `tmwe-disconnect` / `tmwe-proxy`.

## Verifica post-implementazione

1. Login con email **whitelisted** + account TMWE valido → atterra su `/v2`. ✅
2. Login con email **NON whitelisted** + account TMWE valido → torna su `/v2/login` con banner "Email non autorizzata". Nessun utente Lovable creato. ✅
3. Sessione attiva da prima del cambio → resta valida (no re-check whitelist al restore, come da memoria). ✅
4. Refresh JWT → nessun signout (regola attuale preservata). ✅

## Aspetti tecnici

- Query whitelist nel callback: `svc.from("authorized_users").select("id").ilike("email", authEmail).maybeSingle()`. Se preferisci uniformità, possiamo invocare la stessa funzione DB `is_email_authorized` via `svc.rpc(...)`.
- Idempotenza: se l'utente fa partire OAuth ma poi viene rifiutato, nessun side-effect (state OAuth viene già consumato/cancellato anche in caso di errore).
- Niente migrazione DB necessaria.
