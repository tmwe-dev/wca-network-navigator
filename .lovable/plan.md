

## Fix: Autocompilazione credenziali nel login

### Problema
Gli input del form di login in `Auth.tsx` non hanno gli attributi `name` e `autoComplete`, quindi il browser non offre di salvare o compilare automaticamente le credenziali. Combinato con il fatto che la preview perde il localStorage ad ogni riavvio del sandbox, l'utente deve ridigitare email e password ogni volta.

### Cosa faremo

**File: `src/pages/Auth.tsx`**
- Aggiungere `name="email"` e `autoComplete="email"` all'input email nel tab login
- Aggiungere `name="password"` e `autoComplete="current-password"` all'input password nel tab login
- Aggiungere `name="email"` e `autoComplete="email"` all'input email nel tab registrazione
- Aggiungere `name="new-password"` e `autoComplete="new-password"` all'input password nel tab registrazione
- Aggiungere `name="name"` e `autoComplete="name"` all'input nome nel tab registrazione

### Risultato
- Il browser proporrà di salvare le credenziali dopo il primo login riuscito
- Ai login successivi, email e password verranno precompilati automaticamente
- Funziona sia in preview sia sul sito pubblicato

### Nota importante
La sessione nella **preview** si perde comunque ad ogni riavvio del sandbox (limite infrastrutturale). Sul **sito pubblicato** la sessione persiste normalmente tra le visite.

