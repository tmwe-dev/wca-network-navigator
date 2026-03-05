

## Diagnosi: Perché l'AI mappa male i dati

### Il problema nel file sorgente

Il file dell'utente ha una struttura ingannevole:

| Colonna sorgente | Valore tipico | Cosa sembra | Cosa è realmente |
|---|---|---|---|
| `name` | "Cliente", "Nuovo utente", "log" | Nome persona | **Etichetta di categoria** (ripetuta identica su centinaia di righe) |
| `name_2` | "ADAMO PARFUM SRL", "SAP Italia S.r.l." | Secondo nome | **Il vero nome azienda** |
| `alias` | "Cliente" | Alias contatto | **Stessa etichetta di categoria** |
| `alias_2` | "Costruzioni Munaretto s.r.l." | Alias azienda | **Duplicato del nome azienda** |

L'AI vede `name` → lo mappa a `name` (persona). Vede `name_2` → lo mappa a `company_name`. Ma `name` contiene solo etichette ripetitive, non nomi di persone reali.

### 3 problemi nel codice

**Problema 1 — Prompt AI insufficiente**: il prompt non dice all'AI di controllare la **diversità dei valori**. Se una colonna ha solo 3-4 valori unici su 50 campioni, è una categoria/etichetta, non un dato anagrafico.

**Problema 2 — Campi mancanti nel salvataggio**: `useCreateImportFromParsedRows` non salva `position` e `external_id` anche se il mapping li prevede.

**Problema 3 — Nessun group_name**: durante l'import non viene chiesto/salvato il `group_name` nell'import_log.

---

### Piano di correzione

#### 1. Migliorare il prompt AI (`analyze-import-structure`)

Aggiungere al `CONTEXT_PROMPT` una nuova sezione:

```
## REGOLE ANTI-ETICHETTA (CRITICO)
- PRIMA di mappare una colonna, conta i valori UNICI nel campione
- Se una colonna ha ≤5 valori unici su 50 righe (es. "Cliente" ripetuto 40 volte),
  NON è un dato anagrafico — è una ETICHETTA/CATEGORIA
- Etichette comuni da riconoscere: "Cliente", "Nuovo utente", "log", "Fornitore",
  "Agente", "Partner" — queste vanno in "note" o ignorate, MAI in "name"
- Il campo "name" deve contenere nomi DIVERSI su ogni riga (es. "Mario Rossi",
  "Anna Bianchi", "John Smith")
- Se NESSUNA colonna contiene nomi di persona diversi, lascia "name" non mappato

## REGOLE COLONNE DUPLICATE (name, name_2, alias, alias_2)
- Se il file ha "name" e "name_2": confronta i VALORI
  - Se "name" ha pochi valori unici (etichetta) e "name_2" ha valori diversi → 
    "name_2" è il dato reale
  - Se "name_2" contiene suffissi aziendali (Srl, SpA, GmbH, Ltd) → è company_name
  - Se "name_2" contiene nomi di persona → è name
- Stessa logica per "alias" e "alias_2"
```

#### 2. Fix salvataggio campi mancanti (`useImportLogs.ts`)

Aggiungere `position` e `external_id` nel mapping di salvataggio di `useCreateImportFromParsedRows`.

#### 3. Aggiungere input group_name all'import (`Import.tsx`)

Aggiungere un campo di testo "Nome gruppo" nel dialog di upload, che viene salvato come `group_name` nell'`import_logs`.

#### 4. Eliminare tutti i dati importati (SQL)

```sql
DELETE FROM import_errors;
DELETE FROM imported_contacts;
DELETE FROM import_logs;
```

### File da modificare

| File | Modifica |
|---|---|
| `supabase/functions/analyze-import-structure/index.ts` | Aggiungere regole anti-etichetta e colonne duplicate al prompt |
| `src/hooks/useImportLogs.ts` | Aggiungere `position`, `external_id` al salvataggio + `group_name` all'insert di import_logs |
| `src/pages/Import.tsx` | Aggiungere campo "Nome gruppo" nel dialog di upload |
| SQL (insert tool) | Eliminare tutti i dati da `imported_contacts`, `import_errors`, `import_logs` |

