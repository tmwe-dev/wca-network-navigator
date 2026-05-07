## Diagnosi (perché il dropdown Operatore non compare)

Audit DB + codice ha rivelato **3 difetti strutturali** che si combinano:

1. **Doppio utente per la stessa persona TMWE**. In `auth.users` esistono due righe per Jose:
   - `jose@tmwe.it` → ha `user_roles.role=admin` ma **nessuna riga in `operators`** (quindi `useCurrentOperator()` ritorna null).
   - `jose@tmwe.local` → ha `operators.is_admin=true` collegato via `user_id`.
   Quando entri come `jose@tmwe.it`, `OperatorSelector` valuta `currentOp?.is_admin` → `undefined` → **return null**.

2. **OAuth callback ricicla l'utente sbagliato**. `tmwe-oauth-callback`:
   - cerca prima per `tmwe_user_tokens.tmwe_user_id`,
   - poi per email in `auth.users`.
   Il fallback email è `<username>@tmwe.it`, ma in DB l'utente storico è `@tmwe.local` → la `listUsers` non lo trova → ne **crea uno nuovo** invece di riutilizzarlo. Il bind a `operators` (`update ... ilike email`) non scatta perché l'operator row ha email diversa.

3. **Onboarding non garantito**. `handle_new_user` mette `onboarding_completed=false` SOLO sui nuovi auth.users. Gli utenti pre-esistenti (jose@tmwe.it incluso) hanno `true` → non vengono mai forzati nel wizard, quindi profile/operatore non vengono mai allineati a OAuth.

In più: doppio sistema di permessi (`operators.is_admin` **+** `user_roles.role`) non sincronizzati; `useAuthV2` espone 5 azioni legacy disattivate; `LayoutHeader.bak.txt` morto; `ResetPasswordPage` collegata a `updatePassword` no-op.

---

## Obiettivo

Un solo flusso: **TMWE OAuth → utente Lovable unico per email TMWE autoritativa → onboarding obbligatorio prima volta → operator row sempre creata e collegata → admin = `operators.is_admin` (singola fonte di verità) → dropdown selector visibile solo agli admin.**

---

## Cosa cambierà (5 blocchi)

### 1. Reconcile dati esistenti (migrazione una tantum)
- Per ogni `auth.users` con `created_via_tmwe=true` o email `@tmwe.it`/`@tmwe.local`, **garantire una riga in `operators`** (insert se manca, con `is_admin=false`, `is_active=true`).
- **Merge dei duplicati noti**: per `jose`, scegliere come canonico l'utente con la riga `operators` (jose@tmwe.local → ribattezzare email a quella TMWE autoritativa) e marcare l'altro come `is_active=false` + revocare i token. Stesso trattamento per ogni futuro duplicato individuato.
- **Sincronizzare `user_roles.role='admin'` ↔ `operators.is_admin=true`** via trigger AFTER INSERT/UPDATE su `operators`: se `is_admin` cambia, allinea `user_roles`.
- Per tutti gli utenti senza operator row appena creata, settare `profiles.onboarding_completed=false` per forzarli nel wizard al prossimo accesso.

### 2. OAuth callback robusto (un'unica edge function, modifica minima)
`supabase/functions/tmwe-oauth-callback/index.ts`:
- Risoluzione utente in **3 step in ordine**: (a) `tmwe_user_tokens.tmwe_user_id`; (b) `auth.users` per email autoritativa **case-insensitive**; (c) `auth.users` per email alternative (`@tmwe.it`/`@tmwe.local` se username coincide); (d) creazione nuova solo se nessun match.
- Dopo upsert token: **upsert in `operators`** (non più solo update): se non esiste riga col `user_id`, ne crea una con email TMWE, `is_admin=false`, `is_active=true`. Se esiste e l'email è cambiata, la aggiorna.
- Settare `profiles.onboarding_completed=false` **solo** se la riga è appena stata creata (nuovo operatore reale).

### 3. Onboarding obbligatorio + setting admin chiaro
- `OnboardingWizard` resta com'è per il payload (display_name, lingua, telefono, WhatsApp, LinkedIn) ma **al submit garantisce upsert su `operators`** (chiave `user_id`) settando email/name/phone, lasciando `is_admin` invariato (default false).
- **Pannello Operatori (Settings → Operatori)**: il toggle `is_admin` resta l'unica leva per dare ruolo amministratore. Documentare in tooltip "Concede accesso al selettore operatori e alle viste 'tutti'".
- Trigger DB della sezione 1 mantiene `user_roles` allineato.

### 4. UI: selettore operatore deterministico
- `OperatorSelector` continua a leggere `useCurrentOperator()` ma ora la riga **esiste sempre** (garantita da OAuth callback + onboarding submit).
- Condizione di visibilità invariata: `currentOp?.is_admin === true && operators.length > 1`. Risultato: solo admin vedono il dropdown, gli altri no.
- Nessuna modifica a `LayoutHeader` o ad altri header.

### 5. Pulizia codice morto
- Rimuovere da `src/v2/hooks/useAuthV2.ts` le azioni legacy non usate in produzione: `signInWithEmail`, `signUp`, `resetPassword`, `updatePassword`, `clearError`, costante `LEGACY_DISABLED_MSG`, helper `normalizeEmail`, `recordLogin`, `loadProfile/loadRoles` non referenziati a valle. Mantenere `signOut` (usato), `user/session/profile/roles/isAuthenticated/isAdmin/isLoading`.
- Rimuovere `src/v2/ui/pages/ResetPasswordPage.tsx` e la rotta `/reset-password` (azione no-op, non raggiungibile dal nuovo flusso TMWE-only).
- Rimuovere `src/v2/ui/templates/LayoutHeader.bak.txt` (file `.bak.txt` esplicito).
- Aggiornare `useAuthV2` types e qualsiasi import rotto (atteso: 0 impatti reali, le funzioni sono già no-op).

---

## File toccati

- **Migrazione SQL** (nuova): reconcile operators + trigger sync `is_admin ↔ user_roles` + reset onboarding per chi non ha mai fatto il wizard.
- `supabase/functions/tmwe-oauth-callback/index.ts`: risoluzione utente + upsert operators + onboarding flag.
- `src/components/onboarding/OnboardingWizard.tsx`: aggiunge upsert `operators` al submit.
- `src/v2/hooks/useAuthV2.ts`: rimozione azioni legacy.
- `src/v2/ui/pages/ResetPasswordPage.tsx`: cancellato.
- `src/App.tsx` (o router): rimossa rotta `/reset-password` se presente.
- `src/v2/ui/templates/LayoutHeader.bak.txt`: cancellato.

## Dettagli tecnici (per audit)

- Trigger DB: `AFTER INSERT OR UPDATE OF is_admin ON operators` → upsert/delete in `user_roles` (role='admin') per il `user_id` collegato. SECURITY DEFINER + `search_path=public`.
- OAuth callback: prima dell'upsert tokens, eseguire `select id from auth.users where lower(email)=lower($authEmail)` via `admin.auth.admin.listUsers` (paginato; oggi prende solo prima pagina di 200 — si aggiunge fallback su `username@tmwe.local` e `username@tmwe.it`).
- `OnboardingWizard.handleSubmit`: dopo update profiles, `supabase.from("operators").upsert({user_id, email: session.user.email, name: displayName, phone, is_active: true}, { onConflict: "user_id" })`. `is_admin` non viene mai toccato dal wizard.
- Reconcile JOSE specifico: identificare programmaticamente record con stesso `lower(split_part(email,'@',1))` su `tmwe.it`/`tmwe.local`, mantenere quello con operator row, deattivare l'altro.

## Cosa NON cambia

- Edge functions email/IMAP critiche (`check-inbox`, `email-imap-proxy`, `mark-imap-seen`).
- `AuthProvider`, `useAuth`, JWT-locale flow.
- Whitelist `authorized_users` e `is_email_authorized()`.
- Schema RLS esistente.
- `MailboxSelector` e tutto il sottosistema mailbox condivise (lavoro in corso separato).
