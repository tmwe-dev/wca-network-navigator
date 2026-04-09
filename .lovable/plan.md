

# Piano: Da "Guida Operativa" a "Jobs Board" con Prompt AI Auto-Generati

## Concetto

Trasformare la sezione "Guida Operativa" nei Settings in un **Jobs Board** — un elenco di attività operative attive (jobs) che il Supervisor AI gestisce in parallelo. Ogni job ha istruzioni, scadenza, canali, e un **prompt AI auto-generato** visibile con un'icona accanto alla riga.

## Struttura di un Job

Ogni job contiene:
- **Titolo** (es. "Promozione FindAir ai partner WCA")
- **Istruzioni libere** dell'utente (cosa fare, come, con quali documenti)
- **Scadenza** (data entro cui completare)
- **Canali** (email, WhatsApp, LinkedIn, telefono)
- **Stato** (attivo, completato, in pausa)
- **Prompt AI generato** — creato automaticamente dall'AI analizzando le istruzioni, visibile con icona ⚡ accanto alla riga

## Persistenza

Usiamo la tabella `ai_work_plans` già esistente:
- `title` → nome del job
- `description` → istruzioni libere dell'utente
- `steps` → JSON con canali, scadenza, target
- `metadata` → contiene il `generated_prompt` (testo del prompt AI auto-generato)
- `status` → draft/running/paused/completed
- `tags` → categorizzazione (campagna, telefonate, email, ricerca)

Nessuna migrazione necessaria — la struttura attuale copre tutto.

## Implementazione

### 1. Nuovo componente `OperativeJobsBoard.tsx`
Sostituisce `OperativeGuideSettings.tsx` nel tab Settings "Guida Operativa" (rinominato "Jobs Operativi").

**Layout:**
- Lista dei jobs attivi con: titolo, scadenza, stato (badge), canali (chip), icona ⚡ per vedere il prompt generato
- Bottone "Nuovo Job" che apre un form inline
- Click su ⚡ → dialog/popover che mostra il prompt AI generato
- Azioni per riga: pausa, completa, elimina, rigenera prompt

**Form nuovo job:**
- Titolo (input)
- Istruzioni (textarea — l'utente scrive cosa vuole in linguaggio naturale)
- Scadenza (date picker)
- Canali (toggle buttons come ora)
- Al salvataggio → chiama AI per generare il prompt strutturato

### 2. Generazione prompt AI
Quando l'utente salva un job, invochiamo l'AI (via `agent-execute` o direttamente il gateway) con:
- Le istruzioni dell'utente
- Il profilo aziendale (da `app_settings`)
- La KB attiva
- Il tono di voce configurato

L'AI produce un prompt strutturato (obiettivo, procedura, criteri, esempi) che viene salvato nel campo `metadata.generated_prompt` del job.

### 3. Visualizzazione prompt (icona ⚡)
Accanto a ogni riga del job, un'icona ⚡ che al click apre un Dialog con:
- Il prompt generato in formato leggibile
- Bottone "Rigenera" per ricalcolarlo
- Bottone "Modifica" per editing manuale

### 4. Aggiornamento Settings.tsx
- Rinominare il tab da "Guida Operativa" a "Jobs Operativi" (icona `Briefcase`)
- Importare `OperativeJobsBoard` al posto di `OperativeGuideSettings`

### 5. Conservare le regole operative
Le regole generali (limiti contatti/giorno, tono, regole etiche) restano come sezione collassabile in cima al Jobs Board — sono le "regole globali" che si applicano a tutti i jobs.

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/settings/OperativeJobsBoard.tsx` | Nuovo — lista jobs + form + prompt viewer |
| `src/components/settings/OperativeGuideSettings.tsx` | Mantenuto come sezione regole globali dentro il board |
| `src/pages/Settings.tsx` | Tab rinominato, nuovo import |
| `src/hooks/useOperativeJobs.ts` | Nuovo — CRUD su `ai_work_plans` filtrato per tag "operative_job" |

## Ordine di esecuzione

1. Hook `useOperativeJobs` (CRUD su ai_work_plans)
2. Componente `OperativeJobsBoard` con lista, form, prompt viewer
3. Integrazione AI per generazione prompt al salvataggio
4. Aggiornamento Settings.tsx

