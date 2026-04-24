

# Piano: Fix LoginPage "Rendered fewer hooks than expected"

## Causa
`src/v2/ui/pages/LoginPage.tsx` riga 31 fa `return <Navigate>` prima dei `useCallback` di `handleLogin`, `handleSignup`, `handleForgot`. Quando l'utente non è autenticato React registra 5 hook (`useLocation`, `useAuthV2`, 5× `useState`); quando il login va a buon fine `isAuthenticated` diventa `true`, il return parte prima e React registra solo gli hook fino a quel punto → crash al render successivo.

## Fix scelto
Spostare il blocco `if (isAuthenticated && !authLoading) return <Navigate ... />` **dopo** la definizione di tutti gli `useCallback` (subito prima di `switchMode`). Tutti gli hook vengono chiamati incondizionatamente in ogni render, l'early return resta solo per il JSX.

Soluzione alternativa scartata: convertire `switchMode` in `useCallback` non risolverebbe il problema (è una funzione, non un hook) e l'early return resterebbe comunque sopra hook reali.

## Modifica
File: `src/v2/ui/pages/LoginPage.tsx`
- Rimuovere l'`if (isAuthenticated && !authLoading) return <Navigate>` da riga 31
- Reinserirlo dopo `handleForgot` (riga ~58) e prima di `switchMode`

Nessun altro file toccato. Nessun cambio di logica, solo riordino.

## Verifica
- Login con credenziali valide → redirect a `/v2` senza crash
- Refresh su `/v2/login` da utente già loggato → redirect immediato senza errori in console
- Build TS pulito

