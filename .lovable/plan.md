

## Piano di Refactoring: PartnerListPanel + useDownloadProcessor

### Analisi

**PartnerListPanel (941 righe)** mescola 4 responsabilità distinte:
- Logica download/scan directory (righe 77-297) — state, query, scan, cache, cleanup
- Calcolo stats/progress (righe 299-420) — aggregazione server-side, filtri, wizard step
- JSX principale (righe 423-768) — header, wizard, lista partner
- 5 sotto-componenti presentazionali (righe 771-941) — IconIndicator, StatusDot, HorizStep, DownloadChoice, FilterActionBar

**useDownloadProcessor (722 righe)** ha un singolo `startJob` callback di ~600 righe con:
- Logica di processing per singolo profilo ripetuta quasi identica tra Pass 1 e Pass 2
- Rate-limit detection inline con stato mutabile sparso
- Job progress update duplicato in 12+ punti
- Auto-start/orphan recovery separabile

### File da creare/modificare

#### 1. `src/hooks/useDirectoryDownload.ts` (NUOVO)
Estrae da PartnerListPanel tutta la logica download/directory:
- State: selectedNetwork, delay, downloadMode, directoryOnly, scanState, scannedMembers
- Query: directory-cache, db-partners-for-countries, no-profile-wca-ids
- Funzioni: handleStartScan, saveScanToCache, handleStartDownload, executeDownload
- Cleanup automatico post-scan (autoDownloadPending)
- Ritorna: idsToDownload, estimateLabel, isScanning, scanComplete, handleStartScan, handleStartDownload, tutte le variabili di stato necessarie

#### 2. `src/hooks/usePartnerListStats.ts` (NUOVO)
Estrae il calcolo stats e verified:
- Aggregazione serverStats da useCountryStats
- Calcolo stats locali (fallback)
- Logica tri-state verified (email, phone, deep, alias)
- Wizard step derivato
- Ritorna: stats, verified, wizardStep, missingProfiles, missingDeep, etc.

#### 3. `src/components/operations/partner-list/SubComponents.tsx` (NUOVO)
Sposta i 5 componenti presentazionali:
- IconIndicator, StatusDot, HorizStep, DownloadChoice, FilterActionBar

#### 4. `src/components/operations/PartnerListPanel.tsx` (MODIFICA)
Diventa orchestratore ~300 righe:
- Importa useDirectoryDownload, usePartnerListStats, SubComponents
- Mantiene solo: search, sortBy, progressFilter, emailTarget, filteredPartners, JSX

#### 5. `src/lib/download/processProfile.ts` (NUOVO)
Funzione pura per processare un singolo profilo WCA:
```text
processOneProfile(wcaId, jobId, context) → { result, action }
```
- Ensure partner exists
- Extract via extension
- Diagnostic log
- Detect: pageNotLoaded, memberNotFound, extensionError, success
- Save extraction result
- Ritorna un oggetto strutturato con l'azione da intraprendere (retry, skip_permanent, success, pause_job)

#### 6. `src/lib/download/rateLimitDetector.ts` (NUOVO)
Classe stateful per il rilevamento rate-limit:
```text
class RateLimitDetector {
  recordNotFound(htmlLength): void
  isRateLimited(): boolean
  reset(): void
}
```

#### 7. `src/lib/download/jobUpdater.ts` (NUOVO)
Helper per gli aggiornamenti DB del job — elimina le 12+ duplicazioni:
```text
updateJobProgress(jobId, { processedSet, wcaId, contactResult, contactsFound, contactsMissing })
```

#### 8. `src/hooks/useDownloadProcessor.ts` (MODIFICA)
Diventa ~250 righe:
- Pass 1: loop che chiama `processOneProfile` e gestisce l'azione ritornata
- Pass 2: stesso loop con delay +50%, usa stessa `processOneProfile`
- Rate-limit gestito da `RateLimitDetector`
- DB updates tramite `jobUpdater`
- Auto-start/orphan recovery resta inline (piccolo)

### Ordine di esecuzione

1. Creare i moduli utility (`rateLimitDetector`, `jobUpdater`, `processProfile`) — zero impatto, non importati ancora
2. Refactorare `useDownloadProcessor` per usarli — testare che il download funzioni
3. Creare `useDirectoryDownload` e `usePartnerListStats` — zero impatto
4. Estrarre SubComponents
5. Refactorare `PartnerListPanel` per usare i nuovi hook e componenti

### Risultato atteso

| File | Prima | Dopo |
|------|-------|------|
| PartnerListPanel.tsx | 941 | ~300 |
| useDownloadProcessor.ts | 722 | ~250 |
| Nuovi file | 0 | 6 moduli specializzati |

Nessuna modifica alla pagina Campagne.

