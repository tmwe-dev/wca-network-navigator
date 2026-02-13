

## Memorizzare Codici ATECO + Tendine Multi-Selezione per Regioni, Province, ATECO nell'Importer

### Obiettivo

1. Salvare i codici ATECO dal file Excel come dato statico nel progetto (file TypeScript con l'albero completo: ~370 voci con codice, descrizione, livello e categoria padre)
2. Sostituire i campi di testo libero nel ProspectImporter con **tendine multi-selezione** per:
   - **Regioni italiane** (20 regioni, selezione multipla)
   - **Province italiane** (tutte le 107 province, selezione multipla)
   - **Codici ATECO** (dall'albero appena importato, selezione multipla)
3. Mostrare lo status dei job in modo trasparente (gia' parzialmente implementato, va migliorato)
4. Rispettare l'esecuzione sequenziale (un solo job alla volta)

### File da creare

**`src/data/atecoCategories.ts`** -- File statico con l'albero completo ATECO estratto dal file Excel. Struttura:
```typescript
export interface AtecoEntry {
  codice: string;
  descrizione: string;
  livello: 1 | 2 | 3; // 1=sezione(lettera), 2=divisione(2 cifre), 3=gruppo
  padre: string;       // codice della categoria padre
}
export const ATECO_TREE: AtecoEntry[] = [
  { codice: "A", descrizione: "AGRICOLTURA SILVICOLTURA E PESCA", livello: 1, padre: "" },
  { codice: "01", descrizione: "Produzioni vegetali e animali...", livello: 2, padre: "A" },
  // ... tutte le 370 voci dal file
];
```

**`src/data/italianProvinces.ts`** -- File statico con tutte le 20 regioni e 107 province italiane:
```typescript
export const REGIONI_ITALIANE: string[] = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", ...
];
export const PROVINCE_ITALIANE: Array<{ sigla: string; nome: string; regione: string }> = [
  { sigla: "AG", nome: "Agrigento", regione: "Sicilia" },
  // ... tutte le 107 province
];
```

### File da modificare

**`src/components/prospects/ProspectImporter.tsx`** -- Rifattorizzare il form:
- Rimuovere i 3 campi di testo (atecoCode, region, province)
- Aggiungere 3 componenti **Popover + Command** (stile Combobox multi-select) per:
  - **ATECO**: lista gerarchica con ricerca, multi-selezione, chip rimovibili
  - **Regioni**: lista delle 20 regioni, multi-selezione
  - **Province**: lista filtrata per regioni selezionate, multi-selezione
- Sezione di stato job con: barra di progresso, contatori (trovate/salvate/errori), log in tempo reale, nome dell'azienda corrente
- Blocco creazione se un job e' gia' in corso (controllo via `getScrapingStatus`)

**`src/components/prospects/AtecoGrid.tsx`** -- Aggiornare i filtri nel dropdown:
- Regioni: usare Combobox multi-selezione (Popover + Command) invece del semplice `<select>`
- Province: usare Combobox multi-selezione filtrata per regione selezionata

**`src/pages/ProspectCenter.tsx`** -- Aggiornare la gestione dei filtri:
- `regionFilter` e `provinceFilter` diventano array (`string[]`) per supportare multi-selezione
- Passare gli array ai componenti figli

**`src/hooks/useRAExtensionBridge.ts`** -- Aggiornare il tipo dei parametri di `scrapeByAteco` per accettare array:
- `atecoCode` diventa `atecoCodes: string[]`
- `region` diventa `regions: string[]`
- `province` diventa `provinces: string[]`

### Dettaglio tecnico

**Combobox multi-selezione**: usa il pattern gia' esistente nel progetto (Popover + Command di shadcn/ui). Ogni tendina mostra:
- Campo di ricerca in alto
- Lista di opzioni con checkbox
- Chip dei selezionati sotto il trigger
- Pulsante "Deseleziona tutto"

**Filtro province cascata**: quando si seleziona una o piu' regioni, la lista delle province viene filtrata automaticamente per mostrare solo quelle delle regioni selezionate.

**Status job trasparente**: il pannello di progresso gia' esistente viene arricchito con:
- Fase corrente ("Ricerca risultati..." / "Scaricamento profilo X di Y...")
- Nome azienda corrente ben visibile
- Badge con contatori live (trovate, salvate, errori)
- Disabilitazione del pulsante "Avvia" se un job e' gia' attivo
- Messaggio chiaro "Un job e' gia' in esecuzione" se si tenta di avviarne un altro

**Esecuzione sequenziale**: prima di avviare un nuovo scraping, si chiama `getScrapingStatus()`. Se `active === true`, il pulsante e' disabilitato e un avviso spiega che bisogna attendere il completamento del job corrente.

