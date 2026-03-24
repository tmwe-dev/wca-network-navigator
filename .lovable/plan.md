

# Analisi Completa: Processi Download WCA — Dipendenze e Interazioni

## Mappa delle dipendenze

Il sistema di download WCA tocca **7 aree della piattaforma** attraverso una catena di hook, componenti e tabelle DB interconnessi.

```text
                    ┌─────────────────────────┐
                    │  useDownloadEngine.ts    │ ← Motore V7 (client-side)
                    │  circuit breaker, delays │
                    └────────┬────────────────┘
                             │ invoca
                    ┌────────▼────────────────┐
                    │  scrape-wca-partners     │ ← Edge Function (scraping)
                    │  (server-side)           │
                    └────────┬────────────────┘
                             │ scrive su
              ┌──────────────▼──────────────────┐
              │  download_jobs / _items / _events │ ← DB (stato job)
              └──────────────┬──────────────────┘
                             │ letto da (Realtime)
              ┌──────────────▼──────────────────┐
              │     useDownloadJobs.ts           │ ← Singleton Realtime
              └──┬──────┬──────┬──────┬────┬────┘
                 │      │      │      │    │
    ┌────────────▼┐ ┌───▼────┐ ┌▼─────┐ ┌─▼──────────┐ ┌▼───────────────┐
    │Operations.tsx│ │Super   │ │Global│ │ActiveProcess│ │JobHealth       │
    │(Network pg) │ │Home3D  │ │.tsx   │ │Indicator    │ │Monitor         │
    └─────────────┘ └────────┘ └──────┘ └─────────────┘ └────────────────┘
```

## Componenti che consumano dati download

| # | Componente/Hook | Dove | Cosa fa |
|---|----------------|------|---------|
| 1 | **Operations.tsx** | `/network` | Centro operativo download: CountryGrid, ActiveJobBar, JobMonitor, DownloadCanvas, DownloadExperienceDialog, Terminal. Avvia/stoppa job |
| 2 | **ActiveProcessIndicator** | `AppLayout` (header globale) | Badge in alto con progress %, pausa/resume, lista espandibile di tutti i processi attivi |
| 3 | **useJobHealthMonitor** | `AppLayout` (globale) | Rileva job falliti/bloccati/in pausa e mostra toast proattivi |
| 4 | **SuperHome3D** | `/dashboard` | Widget "ActiveJobsWidget" mostra card dei job attivi/recenti con progress bar |
| 5 | **Global.tsx** | `/global` | DownloadStatusPanel nella sidebar sinistra: stats, job attivo con progress, coda, completati |
| 6 | **DownloadExperienceDialog** | Dialog fullscreen | 3 viste: Terminal, Agenda Partner, Profili Live |
| 7 | **LiveOperationCards** | Chat AI (risposta) | Mostra progress dei job inline nelle risposte AI |
| 8 | **OperationsCenter** | Dashboard tab | Pannello real-time con metriche download aggregate |

## Flusso completo di un download

1. **Creazione**: `useCreateDownloadJob` → filtra dead IDs → inserisce `download_jobs` + `download_job_items`
2. **Avvio**: `useDownloadEngine.startJob()` → `claimJob()` → loop con DELAY_PATTERN + circuit breaker
3. **Per ogni profilo**: `markProcessing()` → `scrape-wca-partners` Edge Function → `updateItem()` → `snapshotProgress()` ogni 3 profili
4. **Pausa automatica**: Circuit breaker dopo 5 errori consecutivi → `pauseJob()` → toast da `useJobHealthMonitor`
5. **Completamento**: `finalizeJob()` → invalida queries → toast di completamento
6. **Post-job**: `process-download-job` Edge Function (action=complete) → `verifyDownloadCompleteness()` + `updateNetworkConfigsFromData()`

## Aree di influenza sul PartnerHub

Il PartnerHub (`/network` → PartnerHub.tsx) **non usa direttamente** il download engine, ma:
- I dati scaricati finiscono in `partners` + `partner_contacts` → aggiornano automaticamente le query del PartnerHub
- `useCountryStats` e `usePartners` vengono invalidate dal download engine, quindi il PartnerHub si aggiorna in tempo reale
- Il download NON è avviabile dal PartnerHub — solo da Operations.tsx

## Stato attuale — Problemi identificati

1. **Nessun badge download nel PartnerHub**: Quando un download è attivo per un paese che l'utente sta visualizzando nel PartnerHub, non c'è alcun indicatore visivo
2. **Countdown/pause non visibile fuori da Operations**: Le pause del DELAY_PATTERN e le batch pause (15s ogni 20 profili) sono visibili solo nel Terminal/DownloadExperience. Nessun countdown globale
3. **Duplicazione logica**: `ActiveJobBar`, `DownloadStatusPanel`, `ActiveProcessIndicator` e `ActiveJobsWidget` mostrano tutti la stessa informazione in modi diversi senza coordinamento
4. **PartnerHub disconnesso**: Nessuna integrazione con lo stato download — l'utente non sa se i partner che vede sono aggiornati o se un download è in corso per quel paese

## Piano di intervento raccomandato

### A. Badge download nel PartnerHub
- Aggiungere un indicatore in `PartnerHub.tsx` che mostra quando un download è attivo per il paese selezionato
- Badge con progress %, paese, countdown alla prossima pausa

### B. Countdown globale nel badge header
- Migliorare `ActiveProcessIndicator` per mostrare il countdown delle pause (batch pause, delay pattern)
- Richiede che `useDownloadEngine` emetta eventi di countdown via `download_job_events`

### C. Unificare la visualizzazione
- Il `DownloadStatusPanel` (Global.tsx), `ActiveJobBar` (Operations.tsx), e `ActiveJobsWidget` (SuperHome3D) hanno lo stesso scopo — standardizzare il componente base

### D. Nessuna modifica strutturale necessaria
- Il motore V7 è solido e funzionante
- Le tabelle DB e gli hook sono ben organizzati
- Le Edge Function gestiscono correttamente auth e scraping

---

**In sintesi**: il download funziona bene internamente ma è "invisibile" fuori dalla pagina Operations. Serve propagare lo stato download (con countdown e pause) verso PartnerHub e verso il badge globale nell'header.

