

## Diagnosi dello stato attuale

Il problema fondamentale è nel **prompt dell'edge function `analyze-import-structure`**. Contiene regole hardcoded specifiche (es. "name_2 → company_name", "alias_2 → company_alias", "cell → mobile") che sono handcode mascherato da istruzioni AI. Questo approccio fallisce perché:

1. Il prompt cerca di anticipare ogni possibile formato di file con regole rigide
2. L'AI si confonde tra le regole specifiche e l'analisi reale dei dati
3. Il `column_mapping` viene restituito vuoto nonostante confidence alta

L'utente vuole un approccio completamente diverso: **l'AI deve ragionare autonomamente** sul contesto (CRM per spedizionieri, rubrica commerciale) e decidere il mapping analizzando i VALORI nelle righe, non seguendo regole hardcoded.

## Piano

### 1. Riscrivere il prompt dell'edge function (`supabase/functions/analyze-import-structure/index.ts`)

Eliminare tutte le regole di mapping hardcoded e sostituirle con un prompt contestuale che spiega:

- **Chi siamo**: Una piattaforma CRM per spedizionieri/freight forwarder che gestisce contatti commerciali
- **Cosa facciamo**: Le aziende caricano file con rubriche di contatti per attività commerciali (email, telefono, WhatsApp)
- **La nostra tabella**: Schema esatto di `imported_contacts` con descrizioni chiare di ogni campo
- **Il compito**: "Ti do 50 righe campione da un file in formato sconosciuto. Analizza i VALORI, capisci cosa contengono, e dimmi in quale delle nostre colonne metteresti ogni campo"
- **Dubbi**: Se ci sono campi ambigui, segnalarli nei warnings con la propria ipotesi

Nessuna regola tipo "name_2 → company_name". L'AI deve guardare i valori e dedurre: "questa colonna contiene nomi di aziende, quindi va in company_name".

### 2. Semplificare il frontend (`src/pages/Import.tsx`)

- Rimuovere il fallback `hasParsedRows` che usa `parsed_rows` direttamente — il sistema deve usare SOLO `column_mapping`
- Se `column_mapping` è vuoto, mostrare errore e chiedere di riprovare, non tentare workaround
- Nell'anteprima, mostrare chiaramente il mapping proposto e i campi su cui l'AI ha dubbi (da `warnings`)
- Mantenere la preview reale (trasformazione locale delle prime 5 righe) per conferma visiva

### 3. Struttura del nuovo prompt

```text
CONTESTO: Sei un analista dati per una piattaforma CRM nel settore spedizioni/logistica.
Le aziende caricano file (CSV, Excel) contenenti rubriche di contatti commerciali
(clienti, fornitori, partner) per attività di marketing via email, telefono, WhatsApp.

IL NOSTRO DATABASE ha questa tabella "imported_contacts":
[schema con descrizioni]

IL TUO COMPITO:
1. Ricevi ~50 righe campione da un file di formato sconosciuto
2. Analizza sia i NOMI delle colonne che i VALORI contenuti
3. Per ogni colonna sorgente, decidi in quale campo del nostro database inseriresti quei dati
4. Restituisci il column_mapping (OBBLIGATORIO, mai vuoto se ci sono dati utili)
5. Se hai dubbi su un campo, mettilo comunque nel mapping con la tua migliore ipotesi
   e aggiungi un warning spiegando il dubbio
```

### File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/analyze-import-structure/index.ts` | Prompt riscritto da zero: contesto CRM, nessun handcode, ragionamento sui valori |
| `src/pages/Import.tsx` | Rimuovere fallback parsed_rows, usare solo column_mapping, gestione errori pulita |

