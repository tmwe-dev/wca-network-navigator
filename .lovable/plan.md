

# Piano: Architettura di Comando Agenti con Luca come Direttore

## Problema attuale

`agent-execute` e' un wrapper semplice: manda il prompt all'LLM e restituisce testo. **Non esegue nessun tool reale** — non puo' cercare partner, inviare email, creare download, fare deep search. Gli agenti "parlano" ma non "agiscono".

L'`ai-assistant` invece ha 2700+ righe con 42 tool definitions e logica di esecuzione completa. Gli agenti devono accedere a questa stessa infrastruttura.

## Soluzione: agent-execute con Tool-Calling reale

### Fase 1 — Potenziare agent-execute

**File: `supabase/functions/agent-execute/index.ts`** — Riscrittura completa

Importare le stesse definizioni di tool e la logica di esecuzione dall'`ai-assistant`, ma filtrandoli per `agent.assigned_tools`. Il flusso diventa:

```text
1. Carica agente (prompt + KB + tools assegnati)
2. Filtra TOOL_DEFINITIONS per includere solo quelli in assigned_tools
3. Chiama LLM con tool-calling (function calling)
4. Esegui i tool chiamati dall'LLM sul database
5. Loop fino a risposta finale (max 10 iterazioni)
6. Ritorna risultato
```

Questo significa estrarre le tool definitions e le funzioni di esecuzione in un modulo condiviso che entrambe le edge functions possono importare.

**Nuovo file: `supabase/functions/_shared/tool-definitions.ts`** — Definizioni tool condivise
**Nuovo file: `supabase/functions/_shared/tool-executor.ts`** — Logica di esecuzione tool condivisa

### Fase 2 — Luca come Direttore Operativo

Aggiornare il `system_prompt` e i `assigned_tools` di Luca nel database per riflettere il suo ruolo di CEO/Direttore:

**Prompt specializzato** che include:
- Visione completa del team (nomi, ruoli, competenze di ogni agente)
- Capacita' di creare task per gli altri agenti via tool `create_agent_task`
- Capacita' di leggere lo stato dei task di tutti gli agenti via `list_agent_tasks`
- Capacita' di analizzare le performance del team via `get_team_status`
- Istruzioni su come delegare: chi fa cosa, quando escalare

**Nuovi tool specifici per il direttore:**
- `create_agent_task` — Crea un compito per un agente specifico (by name/role)
- `list_agent_tasks` — Vede tutti i task di tutti gli agenti
- `get_team_status` — Riepilogo performance team (tasks completati, in corso, falliti per agente)
- `update_agent_prompt` — Aggiorna il prompt di un agente subordinato
- `add_agent_kb_entry` — Aggiunge un documento alla KB di un agente

**Tools totali di Luca**: Tutti i 42 tool operativi + i 5 tool di management = 47 tool

### Fase 3 — Gerarchia e flusso operativo

```text
┌─────────────────────────────────────┐
│         LUCA (Direttore)            │
│  - Visione globale                  │
│  - Crea task per il team            │
│  - Monitora performance             │
│  - Aggiorna prompt/KB subordinati   │
├─────────┬───────────┬───────────────┤
│         │           │               │
│  MARCO  │ ROBIN     │ FELICE        │
│  (CSO)  │ (Sales)   │ (Download)    │
│         │ BRUCE     │               │
│ IMANE   │ (Sales)   │ RENATO        │
│ (Intel) │           │ CARLO         │
│ GIGI    │ GIANFR.   │ LEONARDO      │
│ (Enrich)│ (Winback) │ (Outreach x3) │
└─────────┴───────────┴───────────────┘
```

### Fase 4 — Aggiornamento UI

**File: `src/components/agents/AgentDetail.tsx`**
- Aggiungere tab "Team" visibile solo per agenti con ruolo `account` (Luca) che mostra:
  - Lista agenti subordinati con stato e ultimo task
  - Pulsante "Crea task per [agente]"
  - Riepilogo performance team

**File: `src/components/agents/AgentTaskList.tsx`**
- Per Luca: mostrare anche i task creati per altri agenti con indicazione del destinatario

## File da creare/modificare

| File | Azione |
|------|--------|
| `supabase/functions/_shared/tool-definitions.ts` | Creare — estratto da ai-assistant |
| `supabase/functions/_shared/tool-executor.ts` | Creare — estratto da ai-assistant |
| `supabase/functions/agent-execute/index.ts` | Riscrivere — con tool-calling reale |
| `supabase/functions/ai-assistant/index.ts` | Refactorare — importa da _shared |
| Database: agente Luca | UPDATE — nuovo prompt + 47 tool + ruolo elevato |
| `src/data/agentTemplates.ts` | Aggiungere tool di management alla lista AVAILABLE_TOOLS |
| `src/components/agents/AgentDetail.tsx` | Aggiungere tab "Team" per il direttore |

## Risultato atteso

- Ogni agente puo' **agire realmente** sul database (non solo parlare)
- Luca puo' creare task per qualsiasi agente, monitorare il team, aggiornare i loro prompt e KB
- L'utente parla con Luca in chat, Luca delega ai subordinati creando task
- I task vengono poi eseguiti dai singoli agenti con i loro tool specifici
- Zero duplicazione di codice: tool definitions e executor condivisi tra ai-assistant e agent-execute

