## Fix orfani BCA + patch funzione merge + sweep globale

### Cosa fare

1. **Riassegnazione retroattiva 21 BCA orfane**
   - Per ogni `business_card` con `matched_partner_id` puntato a un partner soft-deleted, leggere `duplicate_merge_log` e aggiornare a `canonical_id`.

2. **Patch `merge_duplicate_partners`**
   - Aggiungere `UPDATE business_cards SET matched_partner_id = canonical WHERE matched_partner_id = duplicate` dentro la funzione PL/pgSQL, così ogni futura merge non lascia orfani.

3. **Sweep globale schema**
   - Query su `information_schema.columns` per trovare TUTTE le colonne che referenziano `partners.id` o `partner_contacts.id` o `imported_contacts.id` con nomi non standard (es. `matched_partner_id`, `linked_partner_id`, `referent_id`, `contact_ref`, ecc.).
   - Per ogni colonna trovata: verificare orfani vs `duplicate_merge_log`, riassegnare se necessario, aggiungere alla funzione di merge.

4. **Verifica finale orfani zero**
   - Audit query: per ogni FK identificata, contare righe che puntano a record con `deleted_at IS NOT NULL` per merge reason `duplicate_merge`. Atteso: 0.

5. **Riprendere il cron di merge**
   - Una volta confermato zero orfani e funzione patchata, riavviare/lasciare proseguire il cron sui ~105k duplicati rimanenti di `partner_contacts` + 2.6k `imported_contacts`.

### Sicurezza
- Backup già esistenti (`_backup_partners_2026_05_01`, ecc.) → rollback sempre possibile.
- `duplicate_merge_log` contiene mapping `duplicate_id → canonical_id` per ogni riassegnazione futura.
- Nessun DELETE fisico (soft-delete only, conforme a memoria globale).

### Output atteso
- 0 BCA orfane
- Funzione `merge_duplicate_partners` aggiornata e idempotente su tutte le FK
- Report sweep con elenco colonne FK non standard trovate e gestite
- Cron in esecuzione per completare i ~108k duplicati restanti
