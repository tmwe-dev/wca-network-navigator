

## Piano: Deep Search in background persistente

### Problema attuale
La Deep Search è un loop `for...of` che gira nello state React del componente pagina. Navigando altrove, il componente si smonta e il loop si interrompe silenziosamente.

### Soluzione: Job persistente su database + polling

Riutilizzare lo stesso pattern dei `download_jobs` già esistenti:

1. **Nuova tabella `deep_search_jobs`** (migrazione SQL):
   - `id`, `user_id`, `partner_ids` (jsonb array), `processed_ids` (jsonb array), `status` (pending/running/completed/cancelled), `current_index`, `total`, `results` (jsonb), `created_at`, `updated_at`
   - RLS: utente vede solo i propri job

2. **Modificare `handleDeepSearch` in `Operations.tsx`**:
   - Invece di eseguire il loop inline, inserire una riga in `deep_search_jobs` con `status: 'pending'`
   - Avviare un polling (`setInterval` 3s) che legge lo stato del job e aggiorna i progressi UI

3. **Nuovo edge function `process-deep-search-job`**:
   - Riceve `jobId`, legge i `partner_ids` non ancora processati
   - Esegue la Deep Search per ogni partner (chiamando la logica già in `deep-search-partner`)
   - Aggiorna `processed_ids`, `current_index`, `results` ad ogni step
   - Rispetta l'abort: controlla `status` nel DB prima di ogni iterazione
   - Se `status = 'cancelled'`, si ferma

4. **Avvio del job**:
   - `handleDeepSearch` → insert job → invoke `process-deep-search-job` (fire-and-forget, senza await della risposta completa)
   - Il function timeout di Supabase è ~400s, quindi per batch grandi il job si auto-riprende tramite un meccanismo di "chunking": il function processa N partner, poi se ne mancano altri, si re-invoca

5. **UI: DeepSearchCanvas rimane reattivo**:
   - Il canvas legge lo stato dal DB via polling, non dallo state locale
   - Funziona da qualsiasi pagina: basta aprire il canvas per vedere il progresso
   - Il bottone "Stop" setta `status = 'cancelled'` nel DB

6. **Ripresa automatica**:
   - All'avvio dell'app, controllare se esistono job `running` → mostrare notifica + riprendere il polling

### Alternative più semplice (meno invasiva)

Se preferisci una soluzione più leggera senza nuova tabella:

- **Spostare il loop in un hook globale** (`useDeepSearchRunner`) montato in `AppLayout` (sempre presente)
- Il hook mantiene la coda e il progresso nello state React globale
- Navigando tra pagine il loop continua perché `AppLayout` non si smonta mai
- Svantaggio: chiudendo il browser il progresso si perde

### Raccomandazione

L'approccio **hook globale in AppLayout** è più rapido da implementare e risolve il caso d'uso principale (navigare tra pagine senza perdere il progresso). Il job persistente su DB è più robusto ma richiede più lavoro.

### File da modificare

| File | Modifica |
|------|----------|
| `src/hooks/useDeepSearchRunner.ts` | Nuovo hook globale con coda, loop, progresso |
| `src/components/layout/AppLayout.tsx` | Montare il hook, esporre via context |
| `src/pages/Operations.tsx` | Usare il context invece del loop locale |
| `src/pages/Workspace.tsx` | Usare il context invece del loop locale |
| `src/components/operations/DeepSearchCanvas.tsx` | Leggere progresso dal context |

