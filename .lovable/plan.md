

# Aggiungere "Riavvia Tutti" per i job fermati

## Situazione attuale

Esiste solo il pulsante "BLOCCA TUTTO" nella barra superiore. Dopo un Emergency Stop, per far ripartire i job bisogna cliccare "Riavvia" uno per uno nel JobMonitor -- impraticabile con molti job.

## Cosa cambia

### 1. Nuovo hook `useResumeAllJobs` in `src/hooks/useDownloadJobs.ts`

Una mutation che:
- Trova tutti i job con status `cancelled` che hanno `current_index < total_count` (cioe' incompleti)
- Li aggiorna tutti a `status: 'running'` e `error_message: null` in una sola query
- Mostra un toast con il conteggio dei job riavviati

### 2. Pulsante nella barra superiore di Operations (`src/pages/Operations.tsx`)

Accanto al pulsante "BLOCCA TUTTO" (SpeedGauge), appare un pulsante "RIAVVIA TUTTI" che:
- E' visibile SOLO quando ci sono job cancellati/incompleti e NESSUN job attivo in corso
- Chiama `resetStop()` (per sbloccare il processor) e poi `resumeAll.mutate()`
- Usa un'icona Play con stile verde/emerald per contrasto visivo col rosso dello stop

### 3. Flusso utente

```text
[Job in corso] --> Clicca "BLOCCA TUTTO" --> Tutti i job diventano "cancelled"
                                          --> Appare il pulsante "RIAVVIA TUTTI"
                                          --> Un click li rimette tutti in "running"
                                          --> Il processor li riprende automaticamente dal current_index
```

## Dettagli tecnici

### `useDownloadJobs.ts` - nuovo export

```typescript
export function useResumeAllJobs() {
  // UPDATE download_jobs SET status='running', error_message=null
  // WHERE status='cancelled' AND current_index < total_count
  // Restituisce il count dei job riavviati
}
```

### `Operations.tsx` - nuovo pulsante

Posizionato nella riga della barra superiore (riga ~109), accanto a `WcaSessionIndicator`. Visibile solo quando:
- `cancelledIncompleteJobs.length > 0`
- `activeJobs.length === 0`

Nessun altro file modificato. Due file totali.
