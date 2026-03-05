

## Diagnosi: Perché l'importazione mappa i dati nelle colonne sbagliate

### Bug identificato

Il problema critico è nella funzione `applyMapping` (riga 153 di `Import.tsx`). Questa funzione fa un lookup diretto `row[srcKey]` dove `srcKey` è la chiave restituita dall'AI. **Se l'AI restituisce una chiave anche minimamente diversa da quella normalizzata nel file** (es. `nome` vs `name`, `paese` vs `country`, `citta` vs `city`), il valore non viene trovato e il campo resta `null`.

**Il flusso attuale:**
1. Il file viene parsato e le intestazioni vengono normalizzate (`normalizeKey`)
2. Un campione di ~50 righe con chiavi normalizzate viene inviato all'AI
3. L'AI restituisce un `column_mapping` con coppie `{source → target}`
4. `applyMapping` cerca `row[source]` — **senza alcun matching fuzzy**

**Cosa va storto:**
- L'AI potrebbe restituire `source` con variazioni minime (spazi, underscore diversi, accenti rimossi in modo diverso)
- Non esiste nessuna funzione `findRowKey` con matching a 3 livelli — era documentata nei memory ma **mai implementata**
- Il risultato: molti campi mappati come `null` anche se i dati esistono nel file
- I campi `origin`, `position`, `external_id` sono i più colpiti perché hanno nomi meno standard

### Piano di correzione

#### 1. Aggiungere `findRowKey` con matching fuzzy in `Import.tsx`

Implementare una funzione che cerca la chiave nel row con 3 strategie:
- **Esatto**: `row[srcKey]`  
- **Normalizzato**: confronta `normalizeKey(srcKey)` con `normalizeKey(rowKey)` per ogni chiave del row
- **Fuzzy**: controlla se una chiave contiene l'altra (substring match)

#### 2. Riscrivere `applyMapping` per usare `findRowKey`

```text
Per ogni (srcKey → dstCol) nel mapping:
  1. Prova row[srcKey] direttamente
  2. Se undefined, cerca tra le chiavi del row con normalizzazione
  3. Se ancora undefined, cerca con substring match
  → Assegna il primo valore trovato al campo target
```

#### 3. Aggiungere logging diagnostico nel mapping

Loggare le chiavi del mapping AI vs le chiavi effettive del row per debugging futuro. Questo aiuterà a capire se l'AI restituisce chiavi inaspettate.

#### 4. Validazione post-mapping con conteggio campi

Dopo l'`applyMapping`, contare quanti campi sono stati effettivamente popolati e loggare un warning se troppi campi restano vuoti nonostante il row abbia dati.

### File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Import.tsx` | Aggiungere `findRowKey`, riscrivere `applyMapping` con matching fuzzy, aggiungere log diagnostici |

