

# Piano: Pulsante "Riprendi" nella Cronologia per job cancellati incompleti

## Modifica

Un solo file da toccare: `src/components/download/JobMonitor.tsx`, componente `QueueRow`.

Nella sezione "isCompleted" (riga 153-157), quando il job e `cancelled` e `current_index < total_count` (cioe non e stato completato), aggiungere un pulsante "Riprendi" accanto al badge rosso. Cosi l'utente puo riprendere direttamente dalla cronologia senza dover ricreare il job.

### Cosa cambia nella QueueRow (righe 153-157)

Logica attuale:
- Se `isCompleted`: mostra solo un badge verde (completato) o grigio (cancellato)

Nuova logica:
- Se `isCompleted` e `job.status === "cancelled"` e `job.current_index < job.total_count`: mostra badge rosso + pulsante "Riprendi" (Play icon) che chiama `pauseResume.mutate({ jobId: job.id, action: "resume" })`
- Altrimenti: comportamento invariato (badge verde per completati, badge grigio per cancellati al 100%)

Nessun altro file da modificare -- la logica `resume` nel hook `usePauseResumeJob` gia gestisce il passaggio da `cancelled` a `running`.

