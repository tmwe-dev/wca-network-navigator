

## Redesign Import: AI solo per il mapping, trasformazione locale

### Problema attuale
Il sistema attuale usa **2 chiamate AI**: una per analizzare il mapping (50 righe campione) e poi una **per ogni batch di 25 righe** per "normalizzare". Su 13.000 righe = 521 chiamate AI. Costo insostenibile.

### Nuovo approccio: "1 chiamata AI, tutto il resto locale"

```text
File importato (CSV/Excel/TXT)
    │
    ▼
parseFile() — lettura locale, auto-detect delimitatore
    │
    ▼
Campionamento 50 righe distribuite nel file
    │
    ▼
1 SOLA chiamata AI → analyze-import-structure
    │  Restituisce: column_mapping + data_quality report
    │
    ▼
Applicazione mapping LOCALE a TUTTE le righe (zero AI)
    │  + salvataggio raw_data originali per recovery
    │
    ▼
Inserimento in imported_contacts (già mappati)
    │
    ▼
Report qualità: "X righe con company_name vuoto, Y email invalide"
    │
    ├── Dati OK → Pronti per trasferimento
    └── Dati con problemi → 3 opzioni:
         a) Importa comunque e correggi dopo
         b) Scarica file con foglio aggiuntivo "formato corretto"
         c) Normalizza con AI solo le righe problematiche
```

### Modifiche concrete

**1. `src/pages/Import.tsx` — Refactor del flusso**
- Campionamento intelligente: 50 righe distribuite equamente nel file (non solo le prime 30)
- Dopo conferma mapping, applicare il mapping **localmente** a tutte le righe (già funziona così, ma salvare anche `raw_data` con i dati originali)
- Rimuovere il bottone "Normalizza con AI" come azione di default
- Aggiungere report di qualità post-mapping: contare righe con `company_name` null, email invalide, country mancante
- Aggiungere opzione "Esporta file corretto": genera un Excel con un foglio "Dati Mappati" + un foglio "Formato Richiesto" come guida
- Il normalizzatore AI diventa opzione esplicita solo per le righe problematiche, con stima preventiva del costo

**2. `src/hooks/useImportLogs.ts` — Fix mapping + export**
- Fix `useCreateImportFromParsedRows`: salvare i dati originali della riga in `raw_data` (non i dati mappati)
- Aggiungere hook `useExportCorrectedFile`: genera Excel con mapping applicato + foglio template
- Modificare `useProcessImport` per processare solo righe con problemi (non tutte)

**3. `src/pages/Import.tsx` — Supporto TXT**
- Aggiungere `.txt` ai formati accettati
- Per file TXT: leggere come testo, tentare parsing come CSV (auto-detect delimitatore)
- Se non strutturato, usare la modalità "paste" (analisi AI testo libero)

**4. `supabase/functions/analyze-import-structure/index.ts` — Miglioramento report**
- Aggiungere nel response un campo `data_quality`: conteggio righe con campi critici vuoti nel campione
- Aggiungere `unmapped_columns`: lista colonne del file non mappate (per informare l'utente)

### Dettaglio costi

| Scenario | Prima | Dopo |
|----------|-------|------|
| 13.000 righe | 1 AI mapping + 521 AI normalize = **522 chiamate** | **1 sola chiamata AI** |
| Costo stimato | ~€1-2 | ~€0.002 |
| Righe problematiche (es. 200) | — | 8 chiamate AI (opzionale) |

### UX del normalizzatore "intelligente"

Il bottone "Normalizza con AI" viene sostituito da un pannello informativo:
- Mostra: "3.200 righe con company_name · 12.800 con email · 150 righe con problemi"
- Se ci sono righe problematiche: "150 righe hanno dati incompleti. Vuoi:"
  - "Correggi con AI (~6 chiamate, ~€0.01)" 
  - "Esporta Excel con template per correzione manuale"
  - "Importa comunque"

| File | Modifica |
|------|----------|
| `src/pages/Import.tsx` | Campionamento 50 righe, report qualità, export Excel, normalizzatore solo su problemi |
| `src/hooks/useImportLogs.ts` | Fix raw_data, hook export Excel, processo selettivo |
| `supabase/functions/analyze-import-structure/index.ts` | Aggiungere data_quality e unmapped_columns al response |

