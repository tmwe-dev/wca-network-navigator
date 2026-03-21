

# Piano: Refactoring Deterministico del Download — State Machine + Item-Level Tracking

## Architettura target

```text
┌─────────────────────────────────────────────────────────┐
│                    download_jobs                         │
│  Stati: created → queued → running → completed          │
│         ↘ paused ↗     ↘ completed_with_errors          │
│         ↘ stopping → stopped                             │
│         ↘ failed                                         │
└────────────────────┬────────────────────────────────────┘
                     │ 1:N
┌────────────────────▼────────────────────────────────────┐
│               download_job_items                         │
│  Stati: pending → processing → success                   │
│                              → member_not_found          │
│                              → page_not_loaded           │
│                              → temporary_error           │
│                              → permanent_error           │
│                              → cancelled                 │
└────────────────────┬────────────────────────────────────┘
                     │ append-only
┌────────────────────▼────────────────────────────────────┐
│              download_job_events                         │
│  event_type: job_created, job_started, item_processing,  │
│  item_success, item_failed, job_paused, job_completed    │
└─────────────────────────────────────────────────────────┘
```

## Fase 1 — Modello dati (migrazione DB)

### Tabella `download_job_items`
```sql
CREATE TABLE download_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES download_jobs(id) ON DELETE CASCADE,
  wca_id integer NOT NULL,
  position integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code text,
  last_error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  contacts_found integer NOT NULL DEFAULT 0,
  contacts_missing integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dji_job_status ON download_job_items(job_id, status);
ALTER TABLE download_job_items ENABLE ROW LEVEL SECURITY;
-- RLS: same as download_jobs
```

### Tabella `download_job_events`
```sql
CREATE TABLE download_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES download_jobs(id) ON DELETE CASCADE,
  item_id uuid REFERENCES download_job_items(id),
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dje_job ON download_job_events(job_id, created_at);
ALTER TABLE download_job_events ENABLE ROW LEVEL SECURITY;
```

### Aggiornamento `download_jobs`
- Mantenere la tabella esistente ma il progresso diventa **derivato** da `download_job_items`
- I campi `processed_ids`, `current_index`, `contacts_found_count`, `contacts_missing_count` restano per compatibilita' UI ma vengono aggiornati periodicamente come snapshot, non come fonte di verita'

## Fase 2 — Contratto estensione (error codes stabili)

### `public/chrome-extension/background.js`
Risposta standardizzata con codici fissi:

| state | errorCode | success |
|-------|-----------|---------|
| ok | null | true |
| member_not_found | WCA_PROFILE_NOT_FOUND | false |
| not_loaded | WCA_PAGE_NOT_READY | false |
| login_required | WCA_LOGIN_REQUIRED | false |
| extraction_error | WCA_DOM_PARSE_FAILED | false |
| bridge_error | EXT_BRIDGE_ERROR | false |

Aggiungere campo `debug` con `url`, `title`, `pageLoaded`, `loginDetected`, `domSignals`.

**Regola aurea**: `success = true` solo se `state === "ok"`. Tutti gli altri casi: `success = false`.

Aggiungere rilevamento login page: se il DOM contiene form di login o redirect a login, restituire `state: "login_required"`.

## Fase 3 — Bridge health separato dal profile result

### `src/hooks/useExtensionBridge.ts`
Ogni chiamata restituisce due livelli:

```typescript
interface BridgeResult {
  bridgeHealthy: boolean;      // canale funziona?
  bridgeError?: string;        // EXT_BRIDGE_TIMEOUT, EXT_NO_CONTENT_SCRIPT
  extraction: ExtractionResult | null;  // null se bridge morto
}
```

Il motore usa `bridgeHealthy` per decidere se il sistema e' sano. Usa `extraction.state` per decidere cosa fare col singolo profilo.

Rimuovere completamente il polling. Il bridge risponde solo on-demand.

## Fase 4 — Motore deterministico

### `src/hooks/useDownloadEngine.ts` — Riscrittura

Responsabilita' esatte (e nient'altro):
1. Prendere il prossimo item `pending` o `temporary_error` (se retry)
2. Marcarlo `processing` nel DB
3. Chiamare l'estensione
4. Mappare il risultato a uno stato finale dell'item
5. Salvare i dati estratti (solo se `ok`)
6. Assegnare stato finale all'item
7. Emettere evento nel log
8. Passare al prossimo

**Non deve**: dedurre la sessione globale, avere logiche punitive, avere due verita' tra memoria e DB.

**Quando fermarsi**:
- Stop utente → job `stopping` → finisce item corrente → `stopped`
- Bridge morto (3 consecutive `bridgeHealthy: false`) → job `paused`
- Errore DB grave → job `failed`
- Nessun item processabile rimane → job `completed` o `completed_with_errors`

### `src/lib/download/jobState.ts` — Riscrittura
- `claimJob(jobId)`: status → running + evento
- `updateItem(itemId, status, errorCode?, errorMessage?)`: aggiorna singolo item
- `snapshotProgress(jobId)`: query aggregata da items → aggiorna contatori job
- `finalizeJob(jobId)`: calcola stato finale da items
- `emitEvent(jobId, itemId?, type, payload?)`: append-only log

### `src/lib/download/profileSaver.ts` — Invariato
Gia' pulito: riceve dati, salva nel DB. Unico writer.

## Fase 5 — Eliminare gate e automatismi

### Rimuovere `ensureSession()` come gate
- `ActionPanel.tsx`: rimuovere import e uso di `useWcaSession`
- `useDirectoryDownload.ts`: rimuovere import e uso di `useWcaSession`
- Il job parte sempre. Se WCA non e' accessibile, l'item restituira' `login_required` o `not_loaded`

### `useWcaSession.ts` — Eliminare
Non serve piu'. La sessione emerge dai fatti dell'estrazione.

### `useJobHealthMonitor.ts` — Ridurre a telemetria
Puo' solo: leggere, mostrare toast, segnalare anomalie. Non deve mettere stati ne' decidere stop.

## Fase 6 — Creazione job con items

### `useDownloadJobs.ts` → `useCreateDownloadJob`
Quando crea un job, crea anche tutte le righe `download_job_items`:

```typescript
// 1. Insert job
const job = await supabase.from("download_jobs").insert({...}).select("id").single();
// 2. Insert items (batch)
const items = wcaIds.map((id, i) => ({
  job_id: job.id, wca_id: id, position: i, status: "pending"
}));
await supabase.from("download_job_items").insert(items);
// 3. Emit event
await supabase.from("download_job_events").insert({
  job_id: job.id, event_type: "job_created", payload: { total: wcaIds.length }
});
```

## Fase 7 — Pause, Resume, Stop con semantiche dure

| Azione | Comportamento |
|--------|---------------|
| **Pause** | Job finisce l'item corrente → items pending restano pending → job `paused` |
| **Stop** | Job finisce item corrente → items pending → `cancelled` → job `stopped` |
| **Resume** | Solo items `pending` + `temporary_error` → processabili. Job → `running` |

## Fase 8 — Preflight check manuale

Aggiungere bottone "Test accesso WCA" nella UI:
- Apre un profilo noto via estensione
- Restituisce: `ok`, `login_required`, `extension_unavailable`, `page_not_readable`
- Non blocca nulla. Diagnosi per l'utente.

## File da creare/modificare

| File | Azione | Note |
|------|--------|------|
| Migrazione DB | Creare `download_job_items` + `download_job_events` | Con RLS e indici |
| `public/chrome-extension/background.js` | Modificare | Aggiungere errorCode, debug, login detection |
| `src/hooks/useExtensionBridge.ts` | Modificare | BridgeResult con health separato |
| `src/hooks/useDownloadEngine.ts` | Riscrivere | Item-level loop deterministico |
| `src/lib/download/jobState.ts` | Riscrivere | claimJob, updateItem, snapshotProgress, emitEvent |
| `src/hooks/useDownloadJobs.ts` | Modificare | Creare items alla creazione job |
| `src/hooks/useWcaSession.ts` | Eliminare | Gate rimosso |
| `src/components/download/ActionPanel.tsx` | Modificare | Rimuovere ensureSession, aggiungere preflight |
| `src/hooks/useDirectoryDownload.ts` | Modificare | Rimuovere ensureSession |
| `src/hooks/useJobHealthMonitor.ts` | Semplificare | Solo osservazione |
| `src/components/download/ActiveJobCard.tsx` | Modificare | Progress derivato da items |

## Ordine di esecuzione

1. Migrazione DB (tabelle + RLS)
2. Contratto estensione (background.js)
3. Bridge con health (useExtensionBridge)
4. Job state helpers (jobState.ts)
5. Creazione job con items (useDownloadJobs)
6. Motore deterministico (useDownloadEngine)
7. Eliminare gate (useWcaSession, ActionPanel, useDirectoryDownload)
8. Ridurre monitor a telemetria
9. Aggiornare UI (ActiveJobCard con progress da items)

## Risultato

- Ogni profilo ha il suo stato tracciabile nel DB
- Il progresso e' derivato, non stimato
- Il motore orchestra, non interpreta
- Bridge health e profile result sono separati
- Un solo writer verso il backend (l'app)
- Zero gate preventivi, zero auto-start
- Error codes stabili per debug serio
- Event log append-only per ricostruzione flussi

