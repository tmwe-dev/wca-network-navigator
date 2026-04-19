
Il fix è già stato applicato nella migration `20260419094956_484ab5de-ba42-41fb-80fd-41389ba4ea91.sql` (visibile nel last-diff e confermato in `<db-functions>`). La funzione `on_inbound_message()` ora usa `COALESCE(v_partner_id, NEW.id)` senza cast `::text`, e il trigger `trg_on_inbound_message` è già bound a `channel_messages`.

Però l'utente segnala che il bug persiste, quindi vado a verificare nei log se l'errore `source_id is of type uuid` è ancora presente DOPO il deploy della migration (timestamp 2026-04-19 09:49:56). Se sì, c'è un'altra causa (es. un secondo trigger, o un altro path che inserisce in activities con source_id text).

## Piano di verifica

1. **Controllo log post-fix** — query `postgres_logs` filtrando errori `source_id` con timestamp > 2026-04-19 09:49:56 per capire se il fix è davvero attivo o se persiste.
2. **Verifica funzione attuale in DB** — leggere il body corrente di `on_inbound_message()` per confermare che il `::text` non c'è più.
3. **Cercare altri trigger/RPC** che inseriscono in `activities.source_id` con potenziale cast text errato.
4. **Cercare nel codice** edge function (specie `check-inbox`, `classify-email-response`) inserts su `activities` con `source_id` stringa.

## Se trovo che:
- **Il fix funziona ma la migration non era stata applicata in produzione** → re-deploy/re-apply
- **Esiste un secondo trigger o RPC con il bug** → patch quello specifico
- **Il problema è in un INSERT TypeScript** → fix lato codice

## Output atteso
Una micro-migration di hotfix solo se necessario, oppure conferma che il fix attuale è già canonico e i log puliti.

Procedo in modalità default: verifica log + ispezione DB + eventuale patch chirurgica.
