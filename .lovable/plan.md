

# Fix: Il sistema segnala sessione scaduta senza motivo

## Problema identificato

Dopo un'analisi approfondita dei log, del codice e delle richieste di rete, ho trovato la causa principale:

### 1. Il `process-download-job` NON pulisce mai il campo `error_message`

Quando il pre-auth check riesce (riga 111), il job procede ma il vecchio `error_message` ("Sessione WCA scaduta...") resta nel database dalle esecuzioni precedenti. La UI legge questo messaggio e lo mostra all'utente, facendogli credere che la sessione sia scaduta anche quando funziona perfettamente.

Dai log del server, le ultime esecuzioni mostrano:
```
Job xxx: Auth check passed - proceeding with download
AUTH OK: no login prompt, no members-only
```
Ma il job della Danimarca (ee4e3cf0) ha ancora nel DB:
```
error_message: "Sessione WCA scaduta (members_only). Rinnovo automatico fallito."
```

### 2. La UI mostra l'errore vecchio al resume

Quando l'utente torna alla pagina e il sistema trova un job "running" con un `error_message` vecchio, il polling loop (riga 417-426) mostra il toast "Job in pausa" con il vecchio messaggio di errore.

### 3. Codice morto `directWcaLogin` nello scraper

La funzione `scrape-wca-partners` contiene ~120 righe di codice per un login diretto (righe 565-686) che non viene MAI chiamato. Questo codice e' inutile e confondente.

## Correzioni

### File 1: `supabase/functions/process-download-job/index.ts`

**Pulire `error_message` quando l'auth passa:**

Dopo riga 111 (`Auth check passed`), aggiungere:
```typescript
// Clear any stale error message from previous runs
await supabase
  .from('download_jobs')
  .update({ error_message: null })
  .eq('id', jobId)
```

**Pulire `error_message` anche durante il processing normale:**

Nella sezione di aggiornamento progresso (righe 167-178), assicurarsi che `error_message` venga azzerato ad ogni step riuscito:
```typescript
.update({
  current_index: currentIndex + 1,
  ...
  error_message: null,  // Pulisce errori vecchi
})
```

### File 2: `src/pages/AcquisizionePartner.tsx`

**Al resume, pulire l'error_message del job prima di continuare:**

Quando l'utente clicca "Riprendi" su un job che era in pausa, pulire il vecchio messaggio di errore dal DB:
```typescript
// Prima di invocare process-download-job per il resume
await supabase
  .from("download_jobs")
  .update({ error_message: null, status: "running" })
  .eq("id", jobId);
```

**Non mostrare il toast di errore se il job sta effettivamente processando:**

Nel polling (riga 417), aggiungere un check: se il job e' "paused" ma l'error_message contiene "Rinnovo automatico", ignorarlo perche' e' un messaggio vecchio e forzare il resume.

### File 3: `supabase/functions/scrape-wca-partners/index.ts`

Rimuovere la funzione `directWcaLogin` (righe 565-686) che e' codice morto mai chiamato. Questo elimina ~120 righe inutili e previene confusione futura.

## File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/process-download-job/index.ts` | Pulire error_message quando auth passa + ad ogni step riuscito |
| `src/pages/AcquisizionePartner.tsx` | Pulire error_message al resume + ignorare messaggi vecchi |
| `supabase/functions/scrape-wca-partners/index.ts` | Rimuovere codice morto directWcaLogin (~120 righe) |

## Risultato atteso

- L'utente NON vedra' piu' messaggi "sessione scaduta" quando la sessione e' attiva
- I vecchi messaggi di errore vengono puliti automaticamente
- Il job prosegue senza interruzioni quando l'auth e' valida

