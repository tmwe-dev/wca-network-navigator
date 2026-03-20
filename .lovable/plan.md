

# Piano: Refactoring Completo del Flusso Download

## Problema

Il sistema download è un monolite da 473 righe (`useDownloadProcessor.ts`) con logica duplicata, 3 sistemi di auto-start concorrenti (hook, AppLayout, DownloadStatusPanel), e troppi strati di verifica sessione che si contraddicono a vicenda. Risultato: job che ripartono da soli, processi fantasma, e complessità ingestibile.

## Inventario file da rifattorizzare (solo download)

| File | Righe | Azione |
|------|-------|--------|
| `src/hooks/useDownloadProcessor.ts` | 473 | Riscrivere e spezzare |
| `public/chrome-extension/background.js` | 721 | Spezzare estrazione profilo |
| `src/hooks/useDownloadJobs.ts` | 268 | Snellire (troppe mutation hooks) |
| `src/hooks/useExtensionBridge.ts` | 296 | Snellire |
| `src/lib/download/processProfile.ts` | 130 | Semplificare |
| `src/lib/download/terminalLog.ts` | 111 | OK, tocco minimo |
| `src/components/download/JobMonitor.tsx` | 375 | Spezzare in sotto-componenti |
| `src/components/global/DownloadStatusPanel.tsx` | 158 | Rimuovere auto-start duplicato |
| `src/components/layout/AppLayout.tsx` | 229 | Rimuovere auto-start duplicato |

## Architettura nuova

```text
┌────────────────────────────────────────────────┐
│  useDownloadEngine.ts (< 80 righe)             │
│  - startJob(id) / stop() / isProcessing        │
│  - Nessun auto-start. L'utente avvia.          │
│  - Loop semplice: fetch job → per ogni wcaId → │
│    extractViaExtension → saveResult → next      │
└────────────┬───────────────────────────────────┘
             │
  ┌──────────┴──────────┐
  │                     │
  ▼                     ▼
extractProfile.ts    jobState.ts
(< 60 righe)         (< 40 righe)
Chiama estensione,   Aggiorna DB:
gestisce timeout,    progress, status,
ritorna risultato    contatori
semplice
```

## Cosa cambia concretamente

### 1. Eliminare auto-start multipli
Oggi ci sono **3 posti** che auto-avviano job:
- `useDownloadProcessor.ts` (polling ogni 10s)
- `AppLayout.tsx` (polling ogni 10s)  
- `DownloadStatusPanel.tsx` (timer 5s)

**Azione**: Rimuovere TUTTI e tre. I job partono solo quando l'utente clicca Start o l'AI lo richiede esplicitamente.

### 2. Riscrivere `useDownloadProcessor.ts` → `useDownloadEngine.ts`
Da 473 righe a < 80. Struttura:

```
startJob(jobId):
  1. Fetch job dal DB
  2. Verifica estensione (1 chiamata, niente auto-login)
  3. Loop semplice: per ogni wcaId non processato
     - extractContacts via estensione
     - Se successo → salva, aggiorna contatori
     - Se timeout → aggiungi a retry queue
     - Se "member not found" → segna come inesistente
     - Ogni 3 profili → flush progress al DB
  4. Se retry queue non vuota → secondo giro
  5. Segna job completato
```

Niente: rate-limit detector complesso, session re-verify durante il loop, auto-login, checkpoint delay overlap, contatori consecutiveEmpty/consecutiveSkipped/consecutiveNotFound.

Se l'estensione smette di rispondere → job in pausa con messaggio chiaro. L'utente decide cosa fare.

### 3. Semplificare `processProfile.ts` → inline nel loop
La funzione `processOneProfile` con 7 tipi di ritorno diversi viene eliminata. La logica diventa un semplice if/else nel loop principale.

### 4. Rimuovere `rateLimitDetector.ts`
Troppo complesso e causa falsi positivi. Se il profilo non esiste → skip. Se 5+ timeout consecutivi → pausa job. Fine.

### 5. Rimuovere `sessionVerifier.ts`
La verifica sessione diventa una singola chiamata all'estensione all'inizio del job. Se fallisce → job non parte. Durante il job, se l'estensione smette di rispondere → pausa. Niente auto-login, niente re-verify durante il loop.

### 6. Snellire `background.js`
Estrarre `extractFullProfileFromPage` (247 righe) in un file separato `profileExtractor.js` iniettato come content script. Il background.js resta solo il message handler.

### 7. Spezzare `JobMonitor.tsx`
Da 375 righe → 3 file:
- `JobMonitor.tsx` (< 60) — orchestratore
- `ActiveJobCard.tsx` (< 80) — card job attivo con controlli
- `JobQueue.tsx` (< 40) — lista coda/cronologia

### 8. Bloccare i processi ora
Prima di tutto, cancellare tutti i job running/pending nel DB e rimuovere gli auto-start.

## File da creare/modificare

| File | Azione | Righe target |
|------|--------|--------------|
| `src/hooks/useDownloadEngine.ts` | Creare (sostituisce useDownloadProcessor) | < 80 |
| `src/lib/download/extractProfile.ts` | Creare (logica estrazione semplificata) | < 60 |
| `src/lib/download/jobState.ts` | Creare (aggiornamento stato job) | < 40 |
| `src/hooks/useDownloadProcessor.ts` | Eliminare | — |
| `src/lib/download/processProfile.ts` | Eliminare | — |
| `src/lib/download/rateLimitDetector.ts` | Eliminare | — |
| `src/lib/download/sessionVerifier.ts` | Eliminare | — |
| `src/components/download/ActiveJobCard.tsx` | Creare | < 80 |
| `src/components/download/JobQueue.tsx` | Creare | < 40 |
| `src/components/download/JobMonitor.tsx` | Riscrivere | < 60 |
| `src/components/global/DownloadStatusPanel.tsx` | Rimuovere auto-start | < 120 |
| `src/components/layout/AppLayout.tsx` | Rimuovere auto-start + polling | < 200 |
| `src/hooks/useDownloadJobs.ts` | Snellire | < 200 |
| `public/chrome-extension/background.js` | Estrarre profilo extractor | < 400 |
| `public/chrome-extension/profileExtractor.js` | Creare | < 250 |
| Database | Cancellare job running/pending | — |

## Risultato

- Zero auto-start: l'utente controlla tutto
- Ogni file < 80 righe (salvo background.js < 400 e DownloadJobs < 200)
- Flusso lineare e leggibile: start → loop → save → done
- Se qualcosa va storto → pausa con messaggio chiaro, l'utente decide
- Nessun processo fantasma

