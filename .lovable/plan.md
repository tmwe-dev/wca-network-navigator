

# Eliminazione messaggi WhatsApp dal database

## Situazione attuale
Nel database ci sono **92 messaggi WhatsApp** nella tabella `channel_messages` (con `channel = 'whatsapp'`).

## Cosa farò
Eseguirò una singola operazione DELETE:

```sql
DELETE FROM channel_messages WHERE channel = 'whatsapp';
```

Questo rimuoverà tutti i 92 messaggi WhatsApp senza toccare le 4043 email.

## File coinvolti
Nessuna modifica al codice. Solo operazione dati sul database.

