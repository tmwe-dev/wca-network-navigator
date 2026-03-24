# Piano di Integrazione Claude Engine — WCA Network Navigator

**Data**: 24 Marzo 2026
**Stato**: Da eseguire
**Autore**: Claude Engine V8

---

## MAPPA DEL SISTEMA ATTUALE

### Architettura a 2 livelli

| Livello | Sistema | Stato |
|---------|---------|-------|
| **wca-app** (Vercel) | Login SSO, Discover, Scrape, Save | FUNZIONANTE |
| **wca-network-navigator** (Lovable) | UI React, Supabase, 220+ componenti | PARZIALMENTE INTEGRATO |

### Due sistemi di download COESISTONO (problema principale)

| Sistema | File | Stato |
|---------|------|-------|
| **V8 Claude Engine** | `useDownloadEngine.ts`, `wca-app-bridge.ts`, `localDirectory.ts` | ATTIVO ma login appena fixato |
| **Legacy Lovable** | `useExtensionBridge.ts`, `wcaCredentials.ts`, `wcaScraper.ts` (Edge Functions) | DEPRECATO ma ancora referenziato in 12+ file |

---

## PROBLEMI IDENTIFICATI (per priorità)

### P1 — CRITICI (bloccano il funzionamento)

1. **`useDownloadEngine.ts` getWcaCookie()** — APPENA FIXATO (da committare)
   - Era: `fetchWcaCredentials()` → Edge Function Lovable (fallisce)
   - Ora: login diretto `wca-app.vercel.app/api/login` con body `{}`

2. **`ActionPanel.tsx` (riga 658)** — USA ANCORA il vecchio flusso
   - Chiama `useCreateDownloadJob()` che crea job nel DB
   - Ma il job viene poi processato da `useDownloadEngine.startJob()`
   - Il flusso funziona SE il cookie è valido — verificare end-to-end

3. **`wcaScraper.ts`** — USA ANCORA Edge Functions Supabase
   - `scrapeWcaPartnerById()` → `supabase.functions.invoke("scrape-wca-partners")`
   - `scrapeWcaDirectory()` → `supabase.functions.invoke("scrape-wca-directory")`
   - Usato da: `WcaBrowser.tsx`, `ActionPanel.tsx` (scan directory), `AdvancedTools.tsx`
   - **DEVE** migrare a wca-app bridge

### P2 — IMPORTANTI (funzionalità degradate)

4. **`useExtensionBridge.ts`** — ANCORA IMPORTATO in 4 file
   - `ActiveJobBar.tsx` (riga 13): mostra warning se estensione mancante
   - `useAcquisitionPipeline.tsx` (riga 7): usa extractContacts via estensione
   - `TestDownload.tsx`: test diretto estensione
   - `RuntimeDiagnosticPanel.tsx`: ping estensione
   - **Non eliminare** — serve per LinkedIn e RA. Ma il warning estensione WCA in ActiveJobBar è fuorviante

5. **`ConnectionsSettings.tsx`** — Interfaccia credenziali WCA obsoleta
   - Mostra campi username/password per WCA
   - Salva in `user_wca_credentials` (non più necessario con login server-side)
   - Il bottone "Verifica" chiama `ensureSession()` che funziona (usa wca-app)
   - Ma il resto dell'UI suggerisce che servano credenziali manuali

6. **`Onboarding.tsx`** — Chiede credenziali WCA
   - Step di onboarding richiede username/password WCA
   - Non più necessario: wca-app ha credenziali hardcoded server-side
   - Confonde l'utente

7. **`Diagnostics.tsx`** — Testa Edge Functions deprecate
   - Lista `get-wca-credentials` come edge function da testare
   - Dovrebbe testare wca-app endpoints invece

### P3 — PULIZIA (non bloccanti ma creano confusione)

8. **`wcaCredentials.ts`** — File deprecato ancora importabile
9. **`api/wcaAppBridge.ts`** — Shim deprecato
10. **`useWcaAppFallback.ts`** — Redirect a useWcaAppDownload
11. **`wcaCheckpoint.ts`** — Rate limiter 20s NON usato da V8 engine (V8 ha il suo delay pattern)
12. **`download/profileSaver.ts`** — Salva profili via Supabase diretto, V8 usa `wcaSave()` via bridge

---

## PIANO DI ESECUZIONE — 8 FASI

### FASE 1: Commit e verifica login (5 min)
**File**: `useDownloadEngine.ts`
**Azione**: Il fix a `getWcaCookie()` è già applicato. Serve commit + push + test end-to-end.

Comandi per Mac:
```bash
cd ~/Downloads/wca-network-navigator
git add src/hooks/useDownloadEngine.ts
git commit -m "fix: getWcaCookie login diretto via wca-app"
git pull --rebase origin main && git push origin main
```

**Verifica**: Aprire app → avviare download di 1 paese piccolo → verificare che il login non fallisca.

---

### FASE 2: Migrare wcaScraper.ts a wca-app bridge (30 min)
**File**: `src/lib/api/wcaScraper.ts` (161 righe)

**Stato attuale**: 3 funzioni usano `supabase.functions.invoke()`:
- `scrapeWcaPartnerById(wcaId)` → Edge Function `scrape-wca-partners`
- `previewWcaProfile(wcaId)` → Edge Function `scrape-wca-partners` (preview mode)
- `scrapeWcaDirectory(country, page, cookie)` → Edge Function `scrape-wca-directory`

**Azione**: Riscrivere per usare wca-app bridge:
```typescript
import { wcaScrape, wcaDiscover } from "@/lib/wca-app-bridge";

// scrapeWcaPartnerById → wcaScrape(wcaId, cookie)
// previewWcaProfile → wcaScrape(wcaId, cookie) con flag preview
// scrapeWcaDirectory → wcaDiscover(country, page, cookie)
```

**Dipendenze da aggiornare** (usano le vecchie funzioni):
- `WcaBrowser.tsx` — usa `scrapeWcaPartnerById` per test singolo profilo
- `ActionPanel.tsx` — usa `scrapeWcaDirectory` per scan directory
- `AdvancedTools.tsx` — usa `scrapeWcaPartnerById` per test network
- `acquisition/scanDirectory.ts` — usa `scrapeWcaDirectory`

**Approccio**: Mantenere le stesse firme di funzione ma cambiare implementazione interna. Così i componenti non devono cambiare.

**Nota critica**: Queste funzioni richiedono un cookie WCA. Attualmente il cookie viene passato come parametro o ottenuto dal contesto. Dobbiamo aggiungere `getWcaCookie()` interno (stessa logica di useDownloadEngine).

---

### FASE 3: Aggiornare ActiveJobBar.tsx (15 min)
**File**: `src/components/download/ActiveJobBar.tsx` (260 righe)

**Problema**: Importa `useExtensionBridge` e mostra warning se estensione non disponibile. Con il nuovo sistema, l'estensione WCA NON serve più.

**Azione**:
1. Rimuovere import `useExtensionBridge`
2. Rimuovere la variabile `extensionAvailable`
3. Rimuovere il warning "Estensione non disponibile"
4. Aggiungere indicatore "Claude Engine V8" al posto del warning estensione
5. Il bottone "Avvia" deve continuare a chiamare `onStartJob(jobId)` → invariato

---

### FASE 4: Aggiornare ConnectionsSettings.tsx e Onboarding.tsx (20 min)

#### ConnectionsSettings.tsx
**File**: `src/components/settings/ConnectionsSettings.tsx`

**Azione**:
1. Sezione WCA: Rimuovere campi username/password manuali
2. Sostituire con: stato connessione wca-app + bottone "Verifica connessione"
3. Mostrare: "Login automatico via wca-app.vercel.app (credenziali server-side)"
4. Mantenere il bottone "Verifica" che chiama `ensureSession()` — funziona già
5. Rimuovere download estensione WCA (non serve più)
6. MANTENERE: sezione LinkedIn e RA (usano ancora estensioni)

#### Onboarding.tsx
**File**: `src/pages/Onboarding.tsx`

**Azione**:
1. Rimuovere step credenziali WCA dall'onboarding
2. O trasformarlo in: "Connessione WCA" → verifica automatica → verde se OK
3. L'utente non deve inserire username/password WCA

---

### FASE 5: Aggiornare Diagnostics.tsx (10 min)
**File**: `src/pages/Diagnostics.tsx`

**Azione**:
1. Rimuovere `get-wca-credentials` dalla lista edge functions
2. Aggiungere test endpoint wca-app:
   - Health check: `GET wca-app.vercel.app/api/login` (OPTIONS)
   - Login test: `POST wca-app.vercel.app/api/login` con `{}`
3. Mostrare stato: "wca-app Bridge: ONLINE/OFFLINE"
4. Mantenere test delle altre edge functions (AI, email, deep-search)

---

### FASE 6: Aggiornare Operations.tsx e flusso download (20 min)
**File**: `src/pages/Operations.tsx`

**Stato attuale**: La pagina Operations ha due tab:
- "Download WCA" — usa `useDownloadJobs` + `useDownloadEngine`
- "Rubrica Partner" — usa `PartnerHub`

**Verifiche**:
1. Il flusso ActionPanel → createJob → startJob → useDownloadEngine è coerente?
2. `ActionPanel.tsx` riga 394 `executeDownload()` chiama `createJob` che crea il job in Supabase
3. Poi `onJobCreated(jobId)` chiama `rawStartJob(jobId)` → `useDownloadEngine.startJob()`
4. `startJob` ora usa `getWcaCookie()` → wca-app login diretto ✓

**Azione**:
1. Verificare che `ActionPanel.tsx` scan directory usi il bridge (vedi Fase 2)
2. Assicurarsi che `ResyncConfigure.tsx` (riga 248) verifichi sessione tramite wca-app
3. `WcaBrowser.tsx` deve usare il bridge per test singolo profilo (vedi Fase 2)
4. `SpeedGauge.tsx` — check se usa `wcaCheckpoint` (rate limiter legacy) — se sì, adattare

---

### FASE 7: Pulizia file deprecati (15 min)

**File da aggiornare/annotare**:

| File | Azione |
|------|--------|
| `wcaCredentials.ts` | Aggiungere `console.warn("DEPRECATED")` in fetchWcaCredentials |
| `api/wcaAppBridge.ts` | Già deprecato con re-export — OK |
| `useWcaAppFallback.ts` | Già redirect — OK |
| `download/profileSaver.ts` | Mantenere — usato da legacy code che potrebbe servire |
| `download/extractProfile.ts` | Mantenere — tipi usati altrove |
| `wcaCheckpoint.ts` | Mantenere — potrebbe servire per rate limiting futuro |

**File Chrome Extension** (`public/chrome-extension/`):
- Mantenere ma NON più necessaria per download WCA
- Serve ancora per: cookie sync manuale (fallback)
- Aggiornare `download-wca-extension.html` con nota: "Opzionale — il sistema usa login automatico"

---

### FASE 8: Aggiornare DIARIO_DI_BORDO.md e ClaudeBadge (5 min)

**DIARIO_DI_BORDO.md**: Aggiungere Sessione #5 con riepilogo di tutte le modifiche.

**ClaudeBadge.tsx**: Aggiornare lista moduli attivi:
- ✅ WCA Download Bridge (V8)
- ✅ Directory Locale (localStorage)
- ✅ Login Automatico (server-side)
- ✅ Job Resume System
- ✅ Circuit Breaker + Delay Pattern
- 🔄 wcaScraper migrato a bridge

---

## MAPPA DIPENDENZE — CHI USA COSA

```
useDownloadEngine.ts (V8 ENGINE)
  ├── wca-app-bridge.ts (wcaScrape, wcaSave, wcaLogin)
  ├── localDirectory.ts (createDirectory, markIdDone, markIdFailed...)
  ├── download/jobState.ts (claimJob, updateItem, snapshotProgress...)
  └── localStorage (wca_session_cookie cache)

ActionPanel.tsx (UI DOWNLOAD)
  ├── useDownloadJobs.ts → useCreateDownloadJob (crea job in Supabase)
  ├── wcaScraper.ts → scrapeWcaDirectory ⚠️ USA EDGE FUNCTION — DA MIGRARE
  └── Operations.tsx → onJobCreated → useDownloadEngine.startJob()

ActiveJobBar.tsx (UI PROGRESSO)
  ├── useDownloadJobs.ts (legge stato job)
  ├── useExtensionBridge.ts ⚠️ IMPORT DA RIMUOVERE (solo warning)
  └── usePauseResumeJob (pausa/riprendi)

WcaBrowser.tsx (TEST SINGOLO)
  └── wcaScraper.ts → scrapeWcaPartnerById ⚠️ USA EDGE FUNCTION — DA MIGRARE

AdvancedTools.tsx (TEST NETWORK)
  └── wcaScraper.ts → scrapeWcaPartnerById ⚠️ USA EDGE FUNCTION — DA MIGRARE

scanDirectory.ts (ACQUISIZIONE)
  └── supabase.functions.invoke("scrape-wca-directory") ⚠️ DA MIGRARE

ConnectionsSettings.tsx (SETTINGS)
  ├── useWcaSession.ts ✅ (usa wca-app)
  ├── user_wca_credentials ⚠️ NON PIÙ NECESSARIO
  └── save-wca-cookie Edge Function ⚠️ OPZIONALE

Onboarding.tsx (SETUP)
  └── user_wca_credentials ⚠️ STEP DA RIMUOVERE/SEMPLIFICARE
```

---

## STIMA TEMPI

| Fase | Tempo | Priorità |
|------|-------|----------|
| 1. Commit + verifica login | 5 min | P1 |
| 2. Migrare wcaScraper | 30 min | P1 |
| 3. Aggiornare ActiveJobBar | 15 min | P2 |
| 4. Settings + Onboarding | 20 min | P2 |
| 5. Diagnostics | 10 min | P3 |
| 6. Verifica flusso Operations | 20 min | P1 |
| 7. Pulizia deprecati | 15 min | P3 |
| 8. Diario + Badge | 5 min | P3 |
| **TOTALE** | **~2 ore** | |

---

## FILE NON TOCCATI (confermato sicuro)

Questi file/moduli NON vanno modificati — funzionano indipendentemente:

- `useLinkedInExtensionBridge.ts` — LinkedIn, sistema separato
- `useRAExtensionBridge.ts` — Report Aziende, sistema separato
- `useDeepSearchRunner.ts` — Deep search, usa Edge Functions AI
- `useEmailCampaignQueue.ts` — Email SMTP, sistema separato
- `useSortingJobs.ts` — Sorting email, sistema separato
- `useAgents.ts` / `useAgentTasks.ts` — AI agents, sistema separato
- `useImportLogs.ts` / `useImportWizard.ts` — Import CSV, sistema separato
- `useProspects.ts` — Prospects italiani, sistema separato
- Tutti i componenti `campaigns/`, `cockpit/`, `intelliflow/`, `agents/`
- Tutto `src/components/ui/` (shadcn)
- Tutto `src/data/` (costanti statiche)
- `localDirectory.ts` — GIÀ FUNZIONANTE
- `wca-app-bridge.ts` — GIÀ FUNZIONANTE
- `download/jobState.ts` — GIÀ FUNZIONANTE

---

## ORDINE DI ESECUZIONE RACCOMANDATO

```
FASE 1 → FASE 6 → FASE 2 → FASE 3 → FASE 4 → FASE 5 → FASE 7 → FASE 8
(commit)  (verifica)  (scraper)  (UI)     (settings) (diag)  (pulizia) (doc)
```

Prima commit e verifica end-to-end, poi migrare lo scraper (componente più critico), poi UI e pulizia.
