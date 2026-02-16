

# Refactoring Completo Operations Center

## Analisi dello Stato Attuale

Dall'immagine e dal codice emergono questi problemi:

### Problemi di Performance
1. **CountryGrid: `getStatus()` non memoizzato** -- viene ricalcolato per ogni paese ad ogni render, incluse le fasi di filtraggio e ordinamento. Con 197 paesi, sono centinaia di calcoli ripetuti inutilmente.
2. **Query duplicate** -- `useCountryStats()` e' chiamato sia in CountryGrid che in PartnerListPanel. React Query deduplica, ma il codice e' ridondante.
3. **`coverageColor()` duplicata** -- la stessa funzione identica esiste in CountryGrid.tsx e PartnerListPanel.tsx.
4. **ActionPanel: 3 query separate** per lo stesso set di paesi (`directory-cache`, `db-partners-for-countries`, `no-profile-wca-ids`). Potrebbero essere ridotte.

### Problemi di Struttura
1. **PartnerListPanel.tsx: 541 righe** -- contiene sia la lista partner che il dettaglio completo inline. Il `PartnerDetail` (190 righe) dovrebbe essere un componente separato.
2. **ActionPanel.tsx: 557 righe** -- la logica di scanning della directory (80+ righe di callback) e' mescolata con la UI del pannello download.
3. **StatItem definito inline** in Operations.tsx -- dovrebbe essere un componente riutilizzabile.

### Problemi di Layout (dalla screenshot)
1. **La sidebar sinistra (140px)** funziona bene ma le progress bar sono piccole e difficili da leggere su schermi piu' piccoli.
2. **Il pannello destro** quando nessun paese e' selezionato mostra Terminal + Completati + spazio vuoto -- lo spazio potrebbe essere usato meglio.
3. **Le country card** sono compatte ma il badge di stato a destra (es. "31!", "92%") potrebbe avere tooltip per spiegare il significato.

## Piano di Refactoring

### Fase 1: Estrazione componenti (pulizia strutturale)

**File: `src/components/operations/PartnerDetail.tsx`** (NUOVO)
- Estrarre la funzione `PartnerDetail` da PartnerListPanel.tsx (righe 348-531) in un file dedicato
- Estrarre anche `getBranchCountries` (righe 533-541)
- Importare nel PartnerListPanel originale

**File: `src/components/download/StatItem.tsx`** (NUOVO)
- Estrarre il componente `StatItem` da Operations.tsx (righe 234-267)
- Esportarlo per uso in Operations.tsx e potenzialmente altre pagine

**File: `src/lib/coverageColor.ts`** (NUOVO)
- Estrarre la funzione `coverageColor` duplicata
- Importare in CountryGrid.tsx e PartnerListPanel.tsx eliminando le copie locali

### Fase 2: Ottimizzazione performance CountryGrid

**File: `src/components/download/CountryGrid.tsx`**
- Memoizzare il calcolo degli status con `useMemo` -- calcolare una mappa `statusMap: Record<string, Status>` una sola volta quando cambiano `stats` o `cacheData`
- Usare la mappa pre-calcolata nel filtraggio e rendering invece di chiamare `getStatus()` ripetutamente
- Memoizzare `filtered` con `useMemo` (gia' fatto implicitamente ma dipende da `getStatus` non memoizzato)

Esempio della memoizzazione:
```text
const statusMap = useMemo(() => {
  const map: Record<string, ReturnType<typeof getStatus>> = {};
  WCA_COUNTRIES.forEach(c => { map[c.code] = getStatus(c.code); });
  return map;
}, [stats, cacheData, exploredSet]);
```

### Fase 3: Semplificazione PartnerListPanel

**File: `src/components/operations/PartnerListPanel.tsx`**
- Rimuovere `PartnerDetail` e `getBranchCountries` (spostati in file dedicato)
- Rimuovere `coverageColor` locale (importare da lib)
- Rimuovere import inutilizzati (Suspense, lazy, e molte icone usate solo nel dettaglio)
- Il file passera' da 541 righe a circa 260 righe

### Fase 4: Semplificazione ActionPanel

**File: `src/components/download/ActionPanel.tsx`**
- Estrarre la logica di scansione directory in un hook dedicato `useDirectoryScan`
- Il hook incapsula: stati di scanning, `handleStartScan`, `saveScanToCache`, abort logic
- ActionPanel mantiene solo la UI e le query per i dati
- Il file passera' da 557 righe a circa 350 righe

**File: `src/hooks/useDirectoryScan.ts`** (NUOVO)
- Contiene tutta la logica: `isScanning`, `scanComplete`, `scannedMembers`, `currentPage`, `currentCountryIdx`, `scanError`, `skippedCountries`
- Espone: `handleStartScan()`, `handleAbort()`, `resetScan()`
- Accetta: `selectedCountries`, `networkKeys`, `cachedEntries`, `skipCachedDirs`

### Fase 5: Micro-miglioramenti UI

**File: `src/components/download/CountryGrid.tsx`**
- Aggiungere tooltip al badge di stato delle country card per spiegare il significato (es. "31 profili mancanti", "92% scaricato")
- Queste tooltip danno contesto immediato senza occupare spazio

**File: `src/pages/Operations.tsx`**
- Nella vista "nessun paese selezionato", riorganizzare per dare piu' prominenza al Terminal quando c'e' un job attivo
- Mostrare le statistiche globali di completamento come mini-dashboard invece dello spazio vuoto

## Riepilogo File

| File | Azione | Righe prima | Righe dopo (stima) |
|---|---|---|---|
| `src/components/operations/PartnerDetail.tsx` | NUOVO | - | ~200 |
| `src/components/download/StatItem.tsx` | NUOVO | - | ~40 |
| `src/lib/coverageColor.ts` | NUOVO | - | ~10 |
| `src/hooks/useDirectoryScan.ts` | NUOVO | - | ~120 |
| `src/components/operations/PartnerListPanel.tsx` | Semplificato | 541 | ~260 |
| `src/components/download/ActionPanel.tsx` | Semplificato | 557 | ~350 |
| `src/components/download/CountryGrid.tsx` | Ottimizzato | 306 | ~310 |
| `src/pages/Operations.tsx` | Pulito | 268 | ~240 |

Nessuna modifica al database. Nessuna modifica funzionale -- solo refactoring strutturale e ottimizzazioni.

