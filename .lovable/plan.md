## Obiettivo

Sostituire **completamente** l'auth attuale di WCA (email+password con whitelist `authorized_users`) con **SSO FindAir** come unico Identity Provider, replicando il pattern di SwiftPack Studio. Dopo il login l'utente atterra in WCA con un profilo creato/aggiornato automaticamente con email + nome ricavati da FindAir; telefono, LinkedIn e altri dati personali per le email li compila in autonomia da `/v2/settings`.

## Modello di flusso (da SwiftPack)

```
User → /v2/login → click "Entra con FindAir"
   ↓
Edge: findair-proxy/oauth/start
   - genera state, salva in DB (oauth_state)
   - costruisce authorize_url di FindAir con client_id, redirect_uri della edge
   - ritorna authorize_url al frontend
   ↓
Browser top-level redirect → FindAir authorize page → user logga
   ↓
FindAir → Edge: findair-proxy/oauth/callback?code=...&state=...
   - valida state, scambia code per access_token (POST /oauth/token)
   - chiama userinfo (GET /oauth/userinfo) → email, name, sub
   - cerca/crea utente in auth.users via admin API (service role)
   - genera magic link Supabase (admin.generateLink type=magiclink)
   - upsert su profiles (email, full_name, findair_sub) — telefono/LinkedIn restano vuoti
   - 302 redirect al frontend_callback con il magic link nel hash
   ↓
Browser → /v2/auth/findair-return#access_token=...
   - Supabase client detecta hash → crea sessione locale
   - useEffect detecta isAuthenticated → naviga a redirect originale
```

## Cosa cambia in WCA

### Database (1 migration)
- Nuova tabella `oauth_state` (state token, expires_at) per CSRF protection
- Aggiungere colonna `findair_sub TEXT UNIQUE` su `profiles` per legare utente FindAir → profilo WCA
- **Mantenere `authorized_users` ma renderla opzionale**: la whitelist passa da gate al login a "lista email autorizzate FindAir". Se l'email FindAir non è in whitelist → callback nega l'accesso con errore.

### Edge function nuova: `findair-proxy`
- `verify_jwt = false` in `supabase/config.toml`
- Tre route: `/oauth/start`, `/oauth/callback`, `/oauth/userinfo` (debug)
- Usa secrets: `FINDAIR_CLIENT_ID`, `FINDAIR_CLIENT_SECRET`, `FINDAIR_AUTHORIZE_URL`, `FINDAIR_TOKEN_URL`, `FINDAIR_USERINFO_URL`, più `SUPABASE_SERVICE_ROLE_KEY` (già disponibile)
- CORS whitelist (no `*`) come da regola di progetto

### Frontend
- `LoginPage.tsx` (esistente in `/src/pages/Auth.tsx` o equivalente): rimuovere form email/password, lasciare **solo** bottone "Entra con FindAir" (testo italiano, non spagnolo)
- Nuova route pubblica `/v2/auth/findair-return` → componente che attende che `onAuthStateChange` riceva la sessione e poi naviga al `redirect`
- `AuthProvider` invariato: continua a gestire JWT locale, niente `getUser()` di rete (regola di progetto rispettata)
- Rimuovere il check whitelist dal client (ora avviene server-side nel callback)

### Settings utente
- `/v2/settings` (o pagina profilo esistente): aggiungere sezione **"Dati personali per email"** dove l'utente compila phone, linkedin_url, signature_html, ecc. Questi finiscono su `profiles`.

## Cosa NON tocco

- AuthProvider centralizzato (pattern già conforme)
- Logout, password reset (non più necessario — eliminata UI ma `/v2/reset-password` resta accessibile per chi avesse vecchi link, mostra messaggio "ora si entra con FindAir")
- RBAC `user_roles` + `has_role()`: ruoli continuano a essere gestiti manualmente in WCA, non vengono dedotti da FindAir
- Tutto il resto del sistema (DAL, RLS, edge function business) — l'auth resta basata su JWT Supabase, cambia solo *come* l'utente lo ottiene

## Secrets richiesti

Da aggiungere prima della prima esecuzione:
- `FINDAIR_CLIENT_ID`
- `FINDAIR_CLIENT_SECRET`
- `FINDAIR_AUTHORIZE_URL` (es. `https://auth.findair.com/oauth/authorize`)
- `FINDAIR_TOKEN_URL` (es. `https://auth.findair.com/oauth/token`)
- `FINDAIR_USERINFO_URL` (es. `https://auth.findair.com/oauth/userinfo`)

Il **redirect_uri** che dovrai registrare lato FindAir sarà:
```
https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/findair-proxy/oauth/callback
```

## Ordine di esecuzione

1. **Migration DB** (`oauth_state`, `profiles.findair_sub`, opzionalità whitelist)
2. **Aggiunta secrets** (5 chiavi sopra) — bloccante, aspetto conferma
3. **Edge function `findair-proxy`** (start + callback + userinfo) con test Deno
4. **Frontend**: nuovo `LoginPage`, route `/v2/auth/findair-return`, rimozione form email/password
5. **Settings utente**: sezione dati personali per email (phone/linkedin/signature)
6. **Aggiornamento `mem://auth/whitelist-email-auth-standard` e index** — la regola "no Google OAuth, email+password con whitelist" diventa "SSO FindAir come unico IdP, whitelist applicata server-side nel callback"
7. **QA**: navigo `/v2/login` in preview, verifico bottone, errori se secrets mancano, redirect dopo callback

## Punti di rottura possibili e mitigazioni

- **Sessioni esistenti**: tutti gli utenti già loggati restano loggati (JWT Supabase locale). Al prossimo login dovranno passare da FindAir. Se non sono nella whitelist FindAir restano fuori — **da confermare con te chi è in whitelist**
- **Redirect URI mismatch**: se l'URL registrato su FindAir non combacia esatto col `/functions/v1/findair-proxy/oauth/callback`, il callback fallisce. Va registrato esattamente
- **Iframe Lovable**: top-level redirect (`window.top.location.href`) come SwiftPack — funziona

## Domanda bloccante prima di partire

Dimmi solo: **gli URL FindAir** (authorize, token, userinfo) li hai già pronti? Se sì, appena confermi questo piano:
- creo la migration
- ti chiedo i 5 secrets via tool (compili tu nella form sicura)
- scrivo edge function + frontend
- testiamo insieme
