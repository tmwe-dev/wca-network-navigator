

# Piano: Rimozione Completa Autenticazione

## Obiettivo
Eliminare ogni gate di autenticazione. L'app si apre direttamente su `/v2` con una schermata di selezione operatore obbligatoria. L'utente corrente è determinato esclusivamente dal selettore operatore nell'header.

## Impatto

### File da modificare

1. **`src/v2/ui/templates/AuthenticatedLayout.tsx`** (cuore del cambiamento)
   - Rimuovere `useAuthV2()` e tutti i check `isAuthenticated`, `isLoading`, redirect a `/auth`
   - Rimuovere il gate `sessionReady` — il layout si mostra sempre
   - `backgroundEnabled` diventa `true` dopo 1.5s senza condizioni di sessione
   - Rimuovere query onboarding che dipende da `auth.getUser()`
   - La riga `if (!isAuthenticated) return null` e il loading spinner condizionale vengono eliminati

2. **`src/hooks/useOperators.ts`**
   - Rimuovere `useAuth()` e la condizione `enabled: status === "authenticated"`
   - Le query partono sempre (accesso pubblico)
   - `useCurrentOperator` non può più basarsi su `user.id` — deve usare l'operatore selezionato dal contesto

3. **`src/contexts/ActiveOperatorContext.tsx`**
   - Aggiungere stato `requiresSelection: boolean` — se nessun operatore è selezionato, mostra un overlay di selezione
   - Rimuovere dipendenza da `useCurrentOperator` basato su auth

4. **`src/providers/AuthProvider.tsx`** (`useAuth`)
   - Forzare `status: "authenticated"` sempre, senza sottoscriversi a Supabase auth
   - Oppure fornire un mock statico per non rompere i 47+ file che importano `useAuth()`

5. **`src/components/auth/ProtectedRoute.tsx`**
   - Rendere pass-through: ritorna sempre `<Outlet />` senza check

6. **`src/App.tsx`**
   - Rimuovere la route `/auth` (o redirect a `/v2`)
   - Root `/` → `/v2` (già presente)

7. **`src/pages/Auth.tsx`**
   - Eliminare o svuotare (redirect immediato a `/v2`)

8. **`src/v2/hooks/useAuthV2.ts`**
   - Forzare `isAuthenticated: true`, `isLoading: false`, `isAdmin: true`, `roles: ["admin"]`
   - Mantenere l'interfaccia per non rompere i consumatori
   - Rimuovere tutta la logica di login/signup/signOut/whitelist

9. **`src/v2/hooks/useRequireRole.ts`**
   - Ritorna sempre `true` senza redirect

10. **`src/components/system/ConnectionBanner.tsx`**
    - Rimuovere redirect a `/auth` su SIGNED_OUT
    - Heartbeat senza condizione di sessione

11. **`src/components/header/OperatorSelector.tsx`**
    - Rimuovere il gate `if (!currentOp?.is_admin) return null` — visibile sempre
    - Rimuovere il gate `if (operators.length <= 1) return null`

12. **`src/data/rpc.ts`**
    - `rpcIsEmailAuthorized` e `rpcRecordUserLogin` diventano no-op (return true / void)

### File da creare

13. **`src/components/OperatorSelectionOverlay.tsx`**
    - Overlay fullscreen modale che mostra la lista operatori
    - L'utente deve selezionarne uno per procedere
    - Si integra nel `ActiveOperatorProvider`

### Dettagli Tecnici

- Le RLS policies sulle tabelle Supabase che dipendono da `auth.uid()` dovranno essere bypassate. Dato che l'app non avrà più sessioni auth, le query falliranno a meno di usare la chiave anonima con policy permissive. Valuterò se servono migration per aprire le RLS o se le policy attuali sono già sufficientemente aperte.
- I 47+ file che importano `useAuth()` non verranno toccati singolarmente — il mock a livello di provider garantisce compatibilità.

