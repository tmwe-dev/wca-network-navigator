

## Piano: Miglioramento Schema e Regole AI per Import

### Cosa hai chiesto (riepilogo)

1. **Nuovo campo `position`** nella tabella `imported_contacts` — ruolo/responsabilità della persona (es. "Sales Manager", "Director")
2. **Nuovo campo `external_id`** — codice cliente esterno / ID anagrafica commerciale, NON è un alias
3. **Regole AI aggiornate**:
   - `company_alias` è prodotto internamente dal sistema, MAI mappato da ID esterni o codici
   - Il primo "alias" trovato → `company_alias` (abbreviazione colloquiale dell'azienda)
   - Il secondo "alias" → `contact_alias`
   - **No duplicati**: ogni campo target può essere mappato UNA sola volta; i duplicati vanno in `note`
   - Gli ID numerici/alfanumerici non vanno mai in `company_alias` ma in `external_id` o `note`
   - Campi prioritari: `company_name`, `name`, `email`, `phone`, `country`, `city`, `position`
   - Campi secondari (opzionali): `address`, `zip_code`, `mobile`, `origin`, `external_id`
   - Campi generati internamente (mai importati): `company_alias`, `contact_alias` (a meno che esplicitamente presenti come alias testuali)

### Modifiche tecniche

#### 1. Migrazione database
Aggiungere 2 colonne a `imported_contacts`:
```sql
ALTER TABLE imported_contacts ADD COLUMN position text;
ALTER TABLE imported_contacts ADD COLUMN external_id text;
```

#### 2. Edge Function `analyze-import-structure`
Aggiornare `TARGET_SCHEMA` con i nuovi campi e le descrizioni corrette:
- `position`: "Ruolo/posizione/responsabilità della persona in azienda (es. 'Sales Manager', 'Director', 'Responsabile Commerciale')"
- `external_id`: "Codice identificativo esterno del cliente/contatto nel sistema sorgente (es. ID anagrafica, codice CRM, numero cliente). NON è un alias."
- `company_alias`: ridescritto come "Abbreviazione colloquiale del nome azienda, generata internamente. NON mappare da ID, codici numerici o identificativi esterni."
- `contact_alias`: ridescritto come "Abbreviazione colloquiale del nome contatto, generata internamente."

Aggiornare `CONTEXT_PROMPT` con regole esplicite:
- Sezione "REGOLE ANTI-DUPLICATO": ogni campo target mappato al massimo una volta; eventuali colonne sorgente in eccesso vanno in `note`
- Sezione "REGOLE ALIAS": company_alias e contact_alias sono generati internamente, non importarli da file esterni a meno che non siano chiaramente nomi abbreviati testuali
- Sezione "REGOLE ID": qualsiasi colonna con valori tipo ID numerico/alfanumerico → `external_id`, mai `company_alias`
- Sezione "PRIORITA CAMPI": indicare quali sono essenziali vs opzionali

#### 3. Componenti UI (Import.tsx, ContactsGridTab, CompactContactCard)
Aggiungere visualizzazione del campo `position` nelle card dei contatti importati (sotto il nome, come badge o testo secondario).

#### 4. Trasferimento a Partner
Quando si trasferisce un contatto importato a `partner_contacts`, mappare `position` → `title`.

### File coinvolti
- **Migrazione DB**: nuovo SQL per `imported_contacts` (+2 colonne)
- **`supabase/functions/analyze-import-structure/index.ts`**: schema + prompt aggiornati
- **`src/components/import/CompactContactCard.tsx`**: mostrare `position`
- **`src/pages/Import.tsx`**: passare `position` nel trasferimento a partner

