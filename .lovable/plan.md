

# Piano: Reset Autenticazione e Pulizia Whitelist

## Situazione Attuale

Ho analizzato tutto in profondità. Ecco lo stato reale:

**Auth.tsx è GIÀ corretto** — il codice attuale è il form minimale (email + password, due bottoni Entra/Registrati, nessun Google, nessun tab, nessun reset password, redirect a `/v2`). Il file corrisponde esattamente a quello che avevi richiesto.

**luca@tmwe.it esiste** in auth.users con email confermata, profilo creato, operatore admin. Il login DOVREBBE funzionare se la password è corretta.

## Problemi Identificati

1. **user_roles**: luca@tmwe.it ha ruolo `user` invece di `admin` — alcune pagine (Diagnostics, Telemetry) richiedono ruolo admin e non saranno accessibili
2. **Import morto**: `ProtectedRoute` è importato in App.tsx ma mai usato nel JSX — codice morto da rimuovere
3. **Whitelist sporca**: 4 utenti presenti, l'utente vuole solo luca@tmwe.it
4. **LoginPage.tsx V2 ancora esiste**: `src/v2/ui/pages/LoginPage.tsx` è ancora nel filesystem (usa `useAuthV2` con tabs) — file residuo da eliminare

## Azioni

### 1. Database — Pulizia whitelist e ruoli
```sql
-- Disattivare tutti tranne luca@tmwe.it
UPDATE authorized_users SET is_active = false WHERE email != 'luca@tmwe.it';

-- Promuovere luca@tmwe.it ad admin nei ruoli
UPDATE user_roles SET role = 'admin' WHERE user_id = 'ae35ad39-de57-45df-9d24-538cdbbd5e87';
```

### 2. Eliminare file residui
- `src/v2/ui/pages/LoginPage.tsx` — pagina login V2 obsoleta, ancora presente

### 3. Pulizia App.tsx
- Rimuovere import inutilizzato di `ProtectedRoute`

### 4. Verifica e test
- `npx tsc --noEmit` per confermare compilazione pulita
- Test login su `/auth` con luca@tmwe.it

## Dettagli Tecnici

Il flusso auth attuale funziona così:
```text
/auth (Auth.tsx) → signInWithPassword → navigate("/v2")
/v2/* → AuthenticatedLayout → useAuthV2 → getSession + rpcIsEmailAuthorized
```

Non c'è nessun bug nel codice auth. Se il login fallisce, le cause possibili sono:
- Password errata (l'utente potrebbe aver dimenticato quale password ha usato durante la registrazione)
- Errore PGRST002 transiente (già gestito con retry)

Se la password è persa, l'unica soluzione senza flusso "Password dimenticata" è eliminare l'utente da auth.users e ri-registrarsi.

