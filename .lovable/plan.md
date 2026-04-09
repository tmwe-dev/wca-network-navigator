

# Fix: Operatore non visibile — user_id disallineato

## Problema
L'utente `luca@tmwe.it` ha attualmente l'ID auth `ae35ad39-de57-45df-9d24-538cdbbd5e87`, ma il record operatore nel database punta al vecchio ID `1d51961d-da81-4914-b229-511cdce43e55` (che non esiste più in auth.users). Le RLS policy richiedono `user_id = auth.uid()` per vedere i dati — quindi l'utente vede tutto vuoto.

## Soluzione

### Migrazione SQL
Una singola migrazione che:

1. **Aggiorna `operators.user_id`** da `1d51961d...` a `ae35ad39...` per luca@tmwe.it
2. **Elimina il vecchio profilo** con user_id `1d51961d...` (orfano, non ha più un utente auth)
3. **Aggiorna il profilo nuovo** (`ae35ad39...`) impostando `onboarding_completed = true` e `display_name = 'Luca Arcanà'`

```sql
UPDATE operators 
SET user_id = 'ae35ad39-de57-45df-9d24-538cdbbd5e87' 
WHERE id = '1d194ab7-89f9-48fc-a777-9f2bb30a0bbf';

DELETE FROM profiles 
WHERE user_id = '1d51961d-da81-4914-b229-511cdce43e55';

UPDATE profiles 
SET display_name = 'Luca Arcanà', onboarding_completed = true 
WHERE user_id = 'ae35ad39-de57-45df-9d24-538cdbbd5e87';
```

### Risultato
Dopo la migrazione, l'utente luca@tmwe.it potrà:
- Vedere il proprio operatore
- Essere riconosciuto come admin
- Gestire utenti autorizzati e tutte le impostazioni

Nessun file di codice modificato.

