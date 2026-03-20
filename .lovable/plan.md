

## Status: Piano Già Implementato

Dopo aver analizzato i tre file del piano approvato, confermo che **tutte le modifiche sono già state applicate** nelle iterazioni precedenti:

### Verifiche Completate

| Step | File | Stato |
|------|------|-------|
| Step 1: Filtro dead IDs + limite 1 job | `ai-assistant/index.ts` | ✅ Implementato (righe 967-989, 1070-1076) |
| Step 2: Auto-start fallback 5s | `DownloadStatusPanel.tsx` | ✅ Implementato (righe 30-42) |
| Step 3: Safety net polling 10s | `AppLayout.tsx` | ✅ Implementato (righe 88-100) |

### Dettaglio Tecnico

- **`executeCreateDownloadJob`**: filtra `partners_no_contacts` con `resolved=false`, limita a 1 job attivo, forza delay minimo 15s
- **`executeDownloadSinglePartner`**: stessi filtri dead IDs, stesso limite 1 job, verifica profilo già scaricato
- **`AppLayout`**: polling ogni 10s rileva job `pending` senza job `running` e li avvia
- **`DownloadStatusPanel`**: fallback 5s locale con ref per evitare doppie esecuzioni

### Cosa Resta da Fare (dal messaggio precedente)

Le tre aree ancora mancanti identificate nell'analisi precedente sono:

1. **Controlli pausa/stop globali** -- attualmente solo nel `DownloadStatusPanel`, non accessibili da ogni pagina
2. **Monitoraggio proattivo AI** -- l'AI non controlla autonomamente lo stato dei job dopo la creazione (il tool `check_job_status` esiste ma non viene chiamato automaticamente in background)
3. **Progresso live nella chat** -- le `AiOperationCard` mostrano stato statico, non aggiornano in tempo reale

Se vuoi procedere con una di queste tre aree, indicami la priorità.

