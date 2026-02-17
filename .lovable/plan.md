

# Fix: Job bloccato dopo refresh della pagina

## Problema

Quando la pagina viene ricaricata durante un job attivo:
1. Il loop JavaScript in memoria viene distrutto
2. Il job resta con stato "running" nel database
3. L'auto-start (intervallo 10s) cerca solo job "pending" -- ignora i "running"
4. Il job resta bloccato indefinitamente

## Soluzione

### File: `src/hooks/useDownloadProcessor.ts`

Modificare l'intervallo di auto-start per gestire anche i job "running" orfani:

1. **Rilevamento job orfani**: oltre a cercare job "pending", cercare anche job "running" che non hanno ricevuto aggiornamenti da oltre 60 secondi (segno che nessun tab li sta processando)
2. **Reset automatico**: resettare il job orfano a "pending", cosi il normale flusso di auto-start lo riprende dal `current_index` salvato
3. **Log di recovery**: aggiungere un messaggio nel terminal log per tracciare la ripresa automatica

### Dettaglio tecnico

Nell'`useEffect` dell'auto-start (riga 251-262), aggiungere una query aggiuntiva:

```text
-- Cerca job "running" non aggiornati da piu di 60 secondi
SELECT id FROM download_jobs
WHERE status = 'running'
AND updated_at < NOW() - INTERVAL '60 seconds'
LIMIT 1
```

Se trovato, il sistema:
1. Lo resetta a "pending" con un log "Ripresa automatica dopo refresh"
2. Al ciclo successivo (10s), l'auto-start lo raccoglie normalmente
3. Il processore riprende dal `current_index` salvato senza perdere progressi

### Sicurezza

- Il timeout di 60 secondi evita falsi positivi (un job attivo aggiorna `updated_at` ogni ~20s durante l'elaborazione normale)
- Il claim atomico `WHERE status = pending` nel `startJob` impedisce doppie esecuzioni
- Il `processingRef` sincrono impedisce avvii concorrenti nello stesso tab

### Nessuna modifica ad altri file

Il fix e contenuto interamente nell'`useEffect` dell'auto-start in `useDownloadProcessor.ts`.
