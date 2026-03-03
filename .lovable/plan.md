

## Diagnosi del bug di mapping

Il problema è nel `handleConfirmMapping` (riga 265-273 di Import.tsx). Ecco cosa succede:

1. `parseFile()` legge il file e normalizza le chiavi delle colonne (es. "Nome Contatto" → `nome_contatto`)
2. Le righe campione con queste chiavi normalizzate vengono inviate all'AI
3. L'AI restituisce un `column_mapping` tipo `{"nome": "name", "azienda": "company_name"}`
4. **Il bug**: quando si applica il mapping a TUTTE le righe con `row[src]`, le chiavi `src` restituite dall'AI potrebbero non corrispondere esattamente alle chiavi nelle righe. L'AI potrebbe restituire chiavi leggermente diverse (maiuscole, accenti, spazi) rispetto a quelle normalizzate da `parseFile()`

Risultato: `row[src]` restituisce `undefined` per ogni campo → tutti i 13.032 record vengono salvati vuoti.

## Piano di fix

### 1. Mapping robusto con validazione chiavi (`src/pages/Import.tsx`)

Sostituire il mapping diretto `row[src]` con un sistema a 3 livelli:
- **Livello 1**: match esatto `row[src]`
- **Livello 2**: match normalizzato (entrambe le chiavi passate attraverso `normalizeKey`)
- **Livello 3**: match fuzzy (una chiave contiene l'altra)

Aggiungere una funzione `applyMappingToRow(row, columnMapping)` che:
- Pre-calcola una lookup table `normalizedRowKeys → originalKey` per tutte le chiavi del primo row
- Per ogni entry del mapping AI, trova la chiave corretta nel row usando i 3 livelli
- Logga un warning se nessuna chiave corrisponde

### 2. Anteprima reale prima del salvataggio (`src/pages/Import.tsx`)

Il preview attuale mostra `aiMapping.parsed_rows` (i dati trasformati dall'AI sulle 50 righe campione). Ma l'import reale applica il mapping localmente. Aggiungere un'anteprima che mostri il risultato della trasformazione locale sulle prime 5 righe di `pendingRows`, così l'utente vede esattamente cosa verrà salvato.

### 3. Validazione pre-import con abort (`src/pages/Import.tsx`)

Prima di inserire nel database, verificare che almeno il 10% delle righe abbia almeno un campo non vuoto. Se il mapping produce tutti record vuoti, mostrare un errore e bloccare l'import (invece di salvare 13.000 righe vuote).

### 4. Debug log nel mapping AI (`src/pages/Import.tsx`)

Aggiungere un `console.log` nel mapping che mostra:
- Chiavi presenti nel row: `Object.keys(pendingRows[0])`
- Chiavi nel mapping AI: `Object.keys(aiMapping.column_mapping)`
- Chiavi non trovate nel row

### File modificati

| File | Modifica |
|------|----------|
| `src/pages/Import.tsx` | Mapping robusto a 3 livelli, anteprima reale, validazione pre-import, debug log |

