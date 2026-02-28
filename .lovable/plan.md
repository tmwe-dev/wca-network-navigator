

# Piano: Import Intelligente con Formato Libero e Mapping AI

## Situazione Attuale
La pagina Import accetta solo CSV/Excel con colonne pre-mappate (company_name, email, phone, ecc.). Se il cliente ha un file con colonne diverse (es. "Ragione Sociale", "Telefono Ufficio", "Sede") il sistema tenta un mapping statico limitato. Non c'e' supporto per testo libero incollato.

## Cosa Realizziamo

### 3 Modalita di Input nella tab Upload

1. **Testo Libero (Paste Area)** — L'utente incolla testo grezzo (da email, tabelle copiate, elenchi). AI analizza il contenuto e lo struttura nella tabella `imported_contacts`.

2. **File con Mapping AI Automatico** — L'utente carica il suo file (qualsiasi formato colonne). AI campiona le prime 5 righe, identifica la corrispondenza colonne-fonte → colonne-destinazione, mostra un'anteprima del mapping proposto, e l'utente conferma.

3. **File Standard** (gia esistente) — Il mapping statico attuale per file con colonne note.

### Edge Function: `analyze-import-structure`
Nuova edge function che:
- Riceve un campione di righe (max 5) + tipo input (paste/file)
- Chiama Gemini Flash per generare il mapping colonne
- Per il testo libero: estrae righe strutturate dal testo grezzo
- Ritorna: `{ column_mapping: Record<string, string>, parsed_rows: any[], confidence: number }`

### Flusso Completo

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Input:          │     │ analyze-import-  │     │ Anteprima       │
│  - Paste text    │────▶│ structure        │────▶│ Mapping AI      │
│  - File upload   │     │ (campiona 5 righe│     │ (utente conferma│
│                  │     │  + AI mapping)   │     │  o corregge)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                         ┌──────────────────┐              │
                         │ Importa in       │◀─────────────┘
                         │ imported_contacts │
                         │ (staging)         │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │ process-ai-import │  (normalizzazione batch)
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     ┌────────────────┐  ┌───────────────┐  ┌────────────────┐
     │ OK → Contatti   │  │ Errori →      │  │ Non recuperab. │
     │ nello staging   │  │ Correzione AI │  │ → Export CSV   │
     └────────────────┘  │ batch         │  │ per ricaricare │
                         └───────────────┘  └────────────────┘
```

### Gestione Errori con Export

Nella tab Errori, aggiungiamo:
- **Pulsante "Correggi con AI"** — prende gli errori pending, li manda a AI per tentativo di correzione, aggiorna `corrected_data`
- **Pulsante "Esporta non recuperabili"** — genera un CSV con le righe fallite (raw_data) che l'utente puo correggere manualmente e ricaricare

## Dettaglio Implementazione

### Step 1: Nuova Edge Function `analyze-import-structure`
- Input: `{ sample_rows: any[], input_type: "paste" | "file", raw_text?: string }`
- Per `paste`: AI estrae righe strutturate dal testo libero
- Per `file`: AI mappa colonne sorgente → colonne destinazione
- Output via tool-calling: `{ column_mapping, parsed_rows, confidence, warnings }`

### Step 2: UI — Tab Upload con 3 sotto-sezioni
- **Sotto-tab "Incolla Testo"**: Textarea grande + pulsante "Analizza con AI"
- **Sotto-tab "Carica File"**: File input attuale + step intermedio di conferma mapping
- Dopo analisi AI: mostra tabella anteprima con mapping proposto (colonna sorgente → colonna destinazione)
- Pulsante "Conferma e Importa" che usa il mapping confermato per popolare `imported_contacts`

### Step 3: UI — Tab Errori migliorata
- Pulsante "Correggi con AI" che chiama `process-ai-import` sugli errori pending
- Pulsante "Esporta CSV errori" che genera e scarica un file con le righe non recuperabili
- Contatore errori corretti vs non recuperabili

### Step 4: Aggiornare `process-ai-import`
- Aggiungere modalita `fix_errors` che prende record da `import_errors` e tenta correzione
- Se corretto: inserisce in `imported_contacts` e aggiorna stato errore a `corrected`
- Se non corretto: marca come `dismissed`

### Step 5: Hook `useImportLogs` — nuove mutation
- `useAnalyzeImportStructure` — chiama la nuova edge function
- `useFixImportErrors` — chiama process-ai-import in modalita fix
- `useExportErrors` — genera CSV client-side dalle righe fallite

## File da Creare/Modificare

| File | Azione |
|------|--------|
| `supabase/functions/analyze-import-structure/index.ts` | Creare |
| `supabase/config.toml` | Aggiungere funzione |
| `supabase/functions/process-ai-import/index.ts` | Aggiungere modalita fix_errors |
| `src/pages/Import.tsx` | Ristrutturare tab Upload + migliorare tab Errori |
| `src/hooks/useImportLogs.ts` | Aggiungere nuovi hooks |

