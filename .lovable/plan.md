

# Eliminazione utente Alexander dalla whitelist

## Azione

Creare una migrazione SQL per eliminare `alexander.bittermann.88@gmail.com` dalla tabella `authorized_users`.

```sql
DELETE FROM authorized_users WHERE email = 'alexander.bittermann.88@gmail.com';
```

Un singolo comando, nessuna modifica al codice.

