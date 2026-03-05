

## Diagnosi: Problemi nei Dati Importati

Ho analizzato il database e identificato tre problemi distinti:

### Problemi trovati

1. **1.570 righe completamente vuote** — tutti i campi (company_name, name, email, phone, country) sono NULL. Sono righe spazzatura create durante importazioni di file con righe vuote.

2. **252 righe con la stringa letterale "NULL"** — il testo `"NULL"` è stato salvato come valore effettivo nel campo `company_name` o `name`, anziché come valore NULL reale del database. Questo è il motivo per cui nella lista vedi "NULL" come nome azienda.

3. **Limite 1.000 righe** — la query Supabase restituisce al massimo 1.000 record (su 13.032 totali), quindi vedi solo una porzione dei dati, sbilanciata verso le importazioni più recenti (che includono molte righe sporche).

### Piano di correzione

**Fase 1 — Pulizia dati (migrazione SQL)**
- Eliminare le 1.570 righe completamente vuote
- Convertire tutte le stringhe `"NULL"` in valori NULL reali nei campi: `company_name`, `name`, `email`, `phone`, `country`, `note`

```sql
-- Rimuovi righe completamente vuote
DELETE FROM imported_contacts 
WHERE company_name IS NULL AND name IS NULL 
  AND email IS NULL AND phone IS NULL AND country IS NULL;

-- Converti stringhe "NULL" in NULL reale
UPDATE imported_contacts SET company_name = NULL WHERE company_name = 'NULL';
UPDATE imported_contacts SET name = NULL WHERE name = 'NULL';
UPDATE imported_contacts SET email = NULL WHERE email = 'NULL';
UPDATE imported_contacts SET phone = NULL WHERE phone = 'NULL';
UPDATE imported_contacts SET note = NULL WHERE note = 'NULL';
```

**Fase 2 — Miglioramento query (useContacts.ts)**
- Aggiungere paginazione o aumentare il limite per gestire i 13.000+ record
- Filtrare di default i record che hanno almeno un campo significativo (company_name o email non null)

**Fase 3 — Miglioramento display (ContactListPanel.tsx)**
- Mostrare "Senza nome" al posto di "NULL" o campi vuoti
- Evidenziare visivamente i record incompleti con un badge di qualità

### File da modificare
| File | Modifica |
|------|----------|
| Migrazione SQL | Pulizia dati |
| `src/hooks/useContacts.ts` | Filtro qualità minima + limite query |
| `src/components/contacts/ContactListPanel.tsx` | Display fallback migliorato |

