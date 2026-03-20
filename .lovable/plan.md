

## Analisi: Cosa Usa l'AI vs Cosa Esiste

### Infrastruttura Esistente (UI manuale)

```text
┌─────────────────────────────────────────────────────┐
│  PROTEZIONI ATTIVE (codice esistente)               │
├─────────────────────────────────────────────────────┤
│  wcaCheckpoint.ts      → Gate temporale 20s minimo  │
│  RateLimitDetector     → Rileva anti-bot WCA         │
│  sessionVerifier.ts    → Verifica sessione attiva    │
│  useCreateDownloadJob  → Filtra dead IDs + duplicati │
│  useDownloadProcessor  → Loop con retry, pause auto  │
│  SpeedGauge            → Tachimetro visuale          │
│  JobMonitor            → Controllo velocità, terminal│
│  DownloadStatusPanel   → Stato compatto (Global)     │
└─────────────────────────────────────────────────────┘
```

### Cosa l'AI NON Usa (Problemi)

| Protezione | UI Manuale | AI |
|---|---|---|
| Filtro dead IDs (`partners_no_contacts`) | ✅ `useCreateDownloadJob` | ❌ Manca |
| Limite 1 job attivo alla volta | ✅ `executeDownload` blocca se già running | ⚠️ Permette fino a 3 |
| Auto-start job pending (fallback) | ❌ Dipende da evento DOM | ❌ Se evento perso, job resta pending |
| Delay minimo rispettato | ✅ `wcaCheckpoint` nel processor | ✅ Processor è lo stesso |
| Rate limit detection | ✅ Nel processor | ✅ Processor è lo stesso |

### Cosa Funziona Già Bene

L'esecuzione reale del download (il loop `startJob` in `useDownloadProcessor`) **è lo stesso** sia per UI che per AI. Il processor include tutte le protezioni: checkpoint, rate limit, retry, session verification. Il problema è solo nella **creazione del job** e nel **collegamento evento → processor**.

---

## Piano di Implementazione

### Step 1: Allineare la Creazione Job nell'Edge Function

**File**: `supabase/functions/ai-assistant/index.ts`

In `executeCreateDownloadJob` e `executeDownloadSinglePartner`:
- Aggiungere query a `partners_no_contacts` per escludere dead IDs (stessa logica di `useCreateDownloadJob` riga 112-119)
- Ridurre il limite job attivi da 3 a 1 (coerente con l'UI che blocca se c'è già un job running/pending)
- Forzare delay minimo a 15s (non 10s) per rispettare il green zone del checkpoint

### Step 2: Auto-Start Fallback per Job Pending

**File**: `src/components/global/DownloadStatusPanel.tsx`

Aggiungere un `useEffect` che rileva job in stato `pending` non ancora processati e, dopo 5 secondi di attesa, chiama `startJob()` automaticamente. Questo copre il caso in cui l'evento DOM `ai-ui-action` viene emesso ma non catturato (es. componente non montato).

Richiede l'integrazione di `useDownloadProcessor` nel componente, con un ref per tracciare i job già avviati ed evitare doppie esecuzioni.

### Step 3: Portare Auto-Start anche in AppLayout

**File**: `src/components/layout/AppLayout.tsx`

Aggiungere un polling leggero (ogni 10s) che controlla se esiste un job `pending` nel DB e, se il processor non è già attivo, lo avvia. Questo è il "safety net" definitivo: indipendentemente da come il job è stato creato (UI, AI, API), viene sempre eseguito.

### Risultato

```text
AI crea job → Edge Function (con filtri dead IDs + limite 1 job)
     │
     ▼
  Evento DOM "start_download_job"
     │
     ├─ Catturato da AppLayout → startJob() ✅
     │
     └─ NON catturato?
          │
          ▼
     Polling fallback (AppLayout/DownloadStatusPanel)
     rileva job "pending" → startJob() ✅
```

Le protezioni anti-blocco (checkpoint 20s, rate limit, session check) rimangono invariate nel processor — l'AI le eredita automaticamente perché usa lo stesso `startJob()`.

### File Modificati

| File | Modifica |
|---|---|
| `supabase/functions/ai-assistant/index.ts` | Filtro dead IDs + limite 1 job in entrambi i tool |
| `src/components/layout/AppLayout.tsx` | Polling safety net per job pending |
| `src/components/global/DownloadStatusPanel.tsx` | Auto-start fallback con useDownloadProcessor |

