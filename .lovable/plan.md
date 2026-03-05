

## Piano: Fix mapping colonne e UI di selezione

### Problemi identificati

**Bug 1 — Dati mischiati (causa principale)**: `parseFile` restituisce le righe come `string[][]` (array di array), ma il codice le usa come se fossero oggetti `{header: value}`. Quando l'AI restituisce un mapping tipo `{"Città": "city"}`, il sistema cerca `row["Città"]` su un array — non trova nulla o trova dati sbagliati. Questo causa la duplicazione della città e i campi invertiti.

**Bug 2 — Nessun dropdown per cambiare destinazione**: L'interfaccia di mapping permette solo di trascinare e scambiare le destinazioni tra colonne già mappate. Non c'è modo di selezionare una destinazione diversa da un menu a tendina — se la colonna "Città" è stata mappata a "country", non puoi correggerla a "city" senza che un'altra colonna sia già mappata a "city".

### Correzioni

#### 1. Conversione righe da array a oggetti (file: `Import.tsx`)

Dopo il parsing, convertire ogni riga da `string[]` a `Record<string, string>` usando gli headers:

```text
const { parsed } = await parseFile(file);
const { headers, rows } = parsed;

// Converti string[][] → Record<string, string>[]
const rowObjects = rows.map(row => {
  const obj: Record<string, string> = {};
  headers.forEach((h, idx) => { obj[h] = row[idx] || ""; });
  return obj;
});

setPendingRows(rowObjects);  // ← ora sono oggetti, non array
```

Stessa cosa per il campione inviato all'AI — deve ricevere oggetti con chiavi header, non array.

#### 2. Aggiungere Select dropdown nella UI di mapping (file: `Import.tsx`)

Sostituire l'etichetta draggable della destinazione con un componente `<Select>` che elenca tutte le colonne target disponibili (`TARGET_SCHEMA`), più l'opzione "— Non mappare —" per escludere la colonna:

```text
Colonna Sorgente | Esempio      | → | [Select: company_name ▼] | 🗑
Città            | Milano       | → | [Select: city ▼]         | 🗑  
Paese            | Italy        | → | [Select: country ▼]      | 🗑
```

Il drag-and-drop resta come funzionalità secondaria, ma il Select diventa il controllo principale. Quando si cambia la selezione, se la destinazione scelta era già usata da un'altra riga, quella riga viene automaticamente liberata (target = "").

#### 3. Prevenzione duplicati di destinazione

Aggiungere un controllo che impedisce di assegnare la stessa colonna target a due sorgenti diverse. Se si seleziona "city" per una riga e "city" era già assegnata a un'altra, quella precedente diventa "— Non mappare —" con un toast di avviso.

### File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Import.tsx` | Conversione rows array→oggetti, Select dropdown nel mapping, prevenzione duplicati |

### Risultato atteso

- I dati non saranno più mischiati tra colonne
- L'utente potrà scegliere liberamente la destinazione di ogni colonna sorgente
- Nessuna colonna target potrà essere assegnata due volte

