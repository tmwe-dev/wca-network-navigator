

## Piano: Esportazione errori con dati originali

### Problema
L'export dei record incompleti (riga 504-536 di `Import.tsx`) esporta i campi mappati (`company_name`, `name`, etc.) che per questi record sono vuoti. Il campo `raw_data` (JSON con la riga originale del file sorgente) è salvato in database ma non viene utilizzato nell'export.

### Soluzione
Modificare `handleExportIncomplete` per:

1. **Ricostruire le colonne dal `raw_data`**: leggere le chiavi del primo record `raw_data` disponibile per ottenere gli header originali del file sorgente
2. **Esportare nel formato originale**: usare i valori da `raw_data` invece dei campi mappati vuoti
3. **Aggiungere le colonne meta**: `_import_id` e `motivo_errore` come prima e ultima colonna (per consentire il re-import)

### Risultato atteso
Il CSV esportato avrà:
- `_import_id` (primo campo, per il re-import)
- Tutte le colonne originali del file sorgente (con i dati originali)
- `motivo_errore` (ultimo campo)

### File coinvolto
- `src/pages/Import.tsx` — funzione `handleExportIncomplete` (righe ~504-536)

