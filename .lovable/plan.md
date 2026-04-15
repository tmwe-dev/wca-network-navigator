

# Refactoring Autenticazione + Whitelist

## Problema principale (ADESSO)

Il database Supabase sta restituendo **503 PGRST002** ("Could not query the database for the schema cache") su TUTTE le query. Questo significa che nessuna operazione funziona, inclusa la whitelist check (`rpc is_email_authorized`). Il problema e infrastrutturale, probabilmente causato da una migrazione recente che ha rotto lo schema cache di PostgREST.

**Prima di qualsiasi refactoring del codice, il database deve tornare online.**

## Diagnosi del codice Auth

Ho ispezionato tutti i file critici. La struttura auth e in realta **gia ben fatta**:

| File | Stato | Note |
|---|---|---|
| `src/providers/AuthProvider.tsx` | OK | Provider centralizzato con `onAuthStateChange` + `getSession` bootstrap |
| `src/components/auth/ProtectedRoute.tsx` | OK | Usa `useAuth()`, redirect a `/auth` se non autenticato |
| `src/pages/Auth.tsx` | Funzionale ma migliorabile | Login/Signup con whitelist check via RPC, Google OAuth presente |
| `src/data/rpc.ts` | OK | `rpcIsEmailAuthorized` e `rpcRecordUserLogin` ben implementati |
| `src/App.tsx` | OK | Route pubbliche (`/auth`, `/reset-password`) e protette (`/v1/*`) corrette |

## Piano di intervento

### Step 1 -- Risolvere il 503 del database
- Verificare se una migrazione recente ha causato il problema
- Se necessario, creare una migrazione vuota o di "fix" per forzare il refresh dello schema cache di PostgREST
- Verificare che le RPC `is_email_authorized` e `record_user_login` esistano ancora

### Step 2 -- Pulizia Auth (miglioramenti, non riscrittura)
Il codice auth funziona. I fix sono puntuali:

1. **Rimuovere Google OAuth** dal form `/auth` (il pulsante "Continua con Google" e la dipendenza `lovable.auth.signInWithOAuth`) -- semplifica il flusso a solo email+password+whitelist
2. **Aggiungere toggle visibilita password** ai campi password (come da memoria `auth/ui-auth-password-toggle-standard`)
3. **Gestire il caso 503/errore RPC** nella `checkWhitelist` -- attualmente un errore di rete viene trattato come "non autorizzato" (ritorna `false`), il che blocca l'accesso anche se l'utente e nella whitelist. Fix: mostrare un toast di errore di connessione invece di "non autorizzato"
4. **Unificare `/v2/login` con `/auth`** -- attualmente V2 ha una LoginPage separata che duplica logica. Redirect `/v2/login` a `/auth`

### Step 3 -- Aggiornare memorie di progetto
- Rimuovere la memoria `mem://auth/public-access-no-auth` (obsoleta, l'app usa auth reale)
- Confermare `mem://auth/whitelist-email-auth-standard` come regola attiva

## Dettagli tecnici

### File da modificare:
- `src/pages/Auth.tsx` -- rimuovere Google OAuth, aggiungere toggle password, migliorare error handling su RPC fallita
- `src/v2/routes.tsx` -- redirect `/v2/login` a `/auth`
- `src/v2/ui/pages/LoginPage.tsx` -- eliminare o convertire in redirect
- Memoria: `mem://auth/public-access-no-auth` da eliminare, `mem://index.md` da aggiornare

### File da NON toccare:
- `src/providers/AuthProvider.tsx` -- gia corretto
- `src/components/auth/ProtectedRoute.tsx` -- gia corretto
- `src/data/rpc.ts` -- gia corretto

### Rischi:
- Se il database non torna online (503), nessun fix lato codice risolvera il login
- La rimozione di Google OAuth e irreversibile senza ri-configurazione

