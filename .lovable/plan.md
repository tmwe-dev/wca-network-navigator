## Obiettivo

Eliminare i duplicati nel database **senza perdere alcun dettaglio** e con un backup completo che permetta di ripristinare tutto se qualcosa va storto.

## Stato reale del database (verificato adesso)

| Tabella | Righe attive | Gruppi duplicati | Righe eliminabili | Caso peggiore |
|---|---|---|---|---|
| `partner_contacts` (referenti WCA) | 137.342 | 30.938 | **105.807** | 18 cloni stesso nome |
| `partners` (aziende WCA) | 12.286 | 640 | **1.468** | 24 cloni stessa azienda |
| `imported_contacts` (CRM) | 11.414 | 343 | **2.606** | — |

Causa: tre import massivi del wca-bridge (4-7 aprile 2026) eseguiti senza `UPSERT` e senza vincoli `UNIQUE`. Il numero reale di persone/aziende è circa quello che ti aspettavi (~11k contatti CRM, ~10.800 partner unici, ~31k referenti WCA unici).

## Piano in 4 fasi

### Fase 1 — Backup completo (prerequisito assoluto)

Snapshot delle 3 tabelle in tabelle di backup nello stesso database, con timestamp:

- `_backup_partner_contacts_2026_05_01`
- `_backup_partners_2026_05_01`
- `_backup_imported_contacts_2026_05_01`

Sono copie 1:1 (CREATE TABLE … AS SELECT *). Restano nel DB finché non confermi che tutto funziona, poi si possono archiviare/eliminare. Da queste si può ripristinare qualsiasi riga in qualsiasi momento.

### Fase 2 — Merge "loss-less" dei duplicati

Per ogni gruppo di duplicati si tiene **un solo record "canonico"** (il più vecchio, che ha più storia/relazioni collegate) e si **fondono i dettagli** degli altri prima del soft-delete:

1. **Coalesce dei campi**: per ogni colonna, se il canonico è vuoto e un duplicato ha un valore, il valore viene copiato sul canonico. Nessun dato testuale/contatto va perso.
2. **Riassegnazione delle relazioni**: tutte le righe collegate (interazioni, email, biglietti BCA, note, log, holding pattern, lead_status…) vengono spostate dal duplicato al canonico via UPDATE delle FK.
3. **Soft-delete dei duplicati**: i cloni vengono marcati `deleted_at = now()` con motivo `duplicate_merge_2026_05_01`. Restano nel DB e nel backup, recuperabili.

Ordine di esecuzione:
1. Partner duplicati (640 gruppi → 1.468 righe da unire)
2. Partner_contacts duplicati (30.938 gruppi → 105.807 righe da unire)
3. Imported_contacts duplicati (343 gruppi → 2.606 righe da unire)

Eseguito in **batch piccoli (500 gruppi alla volta)** dentro transazioni, con log dettagliato per ogni merge in una tabella `duplicate_merge_log` (vecchio_id → nuovo_id, campi unificati).

### Fase 3 — Verifica e validazione

- Conteggi prima/dopo con report
- Spot-check su 20 casi noti (es. AMT Mozambique che citavi)
- Verifica che nessuna interazione/email/biglietto sia rimasto orfano
- Possibilità di **rollback completo** ripristinando dal backup di Fase 1 con un solo comando

### Fase 4 — Prevenzione futura

Dopo la pulizia, per evitare che il problema si ripresenti:

- Indici `UNIQUE` su `partner_contacts(partner_id, lower(email), lower(name))` e `partners(lower(company_name), country_code)`
- Refactor del `wca-bridge` e degli import per usare `UPSERT` (`ON CONFLICT DO UPDATE`)
- Trigger di guardia che blocca futuri inserimenti duplicati

## Garanzie

- **Nessun dato testuale perso**: il merge fa coalesce campo per campo
- **Nessuna relazione persa**: tutte le FK vengono riassegnate prima del soft-delete
- **Reversibile al 100%**: backup tabelle + soft-delete + log dei merge
- **Eseguito in batch**: niente lock lunghi, niente downtime
- **Audit completo**: ogni merge tracciato in `duplicate_merge_log`

## Cosa NON fa questo piano

- Non tocca i biglietti BCA (sono già protetti, vengono solo riassegnati al partner canonico)
- Non modifica la UI della pagina duplicati in questa fase (la pulizia è massiva e automatica; la pagina duplicati esistente resta per casi futuri singoli)
- Non elimina fisicamente nulla finché non confermi che tutto è ok dopo Fase 3

## Domanda prima di partire

Confermi che procedo con tutte e 4 le fasi in sequenza (backup → merge → verifica → prevenzione)?
