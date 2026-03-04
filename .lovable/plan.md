

## Piano: Sample data e eliminazione righe nel mapping

### Modifiche a `src/pages/Import.tsx`

**1. Aggiungere esempio dati nella tabella di mapping (righe 790-826)**

Nella tabella di confronto colonne, aggiungere una quarta colonna "Esempio" che mostra il primo valore non-vuoto trovato in `pendingRows` per quella colonna sorgente. Questo permette all'utente di capire cosa contiene ogni campo prima di decidere il mapping.

La tabella diventerà:
```
| Colonna Sorgente | Esempio dato | → | Colonna Destinazione | ✕ |
```

Per ogni riga `src`, il valore di esempio sarà:
```typescript
const sampleValue = pendingRows.find(r => r[src]?.toString().trim())?.[src] || "—";
```
Mostrato troncato a ~40 caratteri con `text-muted-foreground`.

**2. Aggiungere pulsante elimina riga**

Aggiungere una quinta colonna con un'icona `Trash2` che rimuove la entry dal `column_mapping`. Al click:
```typescript
const newMapping = { ...aiMapping.column_mapping };
delete newMapping[src];
setAiMapping({ ...aiMapping, column_mapping: newMapping });
```

La colonna rimossa verrà automaticamente mostrata nella sezione "Colonne non mappate" già esistente (righe 840-849), dato che non sarà più presente nel mapping.

### Risultato
- L'utente vede un esempio concreto dei dati per ogni campo, facilitando la decisione
- L'utente può eliminare righe di mapping che non vuole importare
- Le colonne eliminate appaiono nella sezione "non mappate" come feedback visivo

