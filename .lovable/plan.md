

# Piano: Knowledge Base Master + Accesso Universale Agenti

## Situazione attuale

Oggi ogni agente ha:
- Un `system_prompt` fisso nel DB (tabella `agents`)
- Una `knowledge_base` locale (array JSON nel campo dell'agente)
- Tool filtrati per `assigned_tools`
- Context injection in `agent-execute/index.ts` che carica: profilo utente, memorie L2/L3, KB globale (top 5), storico missioni

**Problemi identificati:**
1. La KB globale (`kb_entries`) viene iniettata solo per le top 5 entries — gli agenti non vedono tutto
2. Gli agenti NON vedono i prompt operativi (`operative_prompts`) — solo `ai-assistant` li carica
3. Nessun agente vede i colleghi: chi sono, cosa fanno, cosa hanno assegnato
4. Il General Manager (Director/Luca) non ha visibilità strutturata su tutti i prompt di sistema
5. Mancano: elenco processi, elenco prompt, elenco luoghi/sezioni — nessuna "directory master"
6. I ruoli e compiti sono hardcoded in `agentTemplates.ts` ma non accessibili runtime agli agenti

## Piano

### Passo 1 — Card KB "Directory Master" auto-generata

Creare una card KB speciale `_system_directory` (in `kb_entries`) che viene auto-costruita e aggiornata dal sistema. Contiene:

```
DIRECTORY SISTEMA — Aggiornata automaticamente

TEAM AGENTI:
- Robin (Sales) — 12 clienti assegnati, 3 task attivi
- Bruce (Sales) — 8 clienti, 1 task attivo
- Renato (Outreach) — 15 clienti, 5 task attivi
...

PROCESSI ATTIVI:
- Outreach Cockpit: genera e invia messaggi multicanale
- Circuito di Attesa: follow-up automatico post-invio
- Download WCA: sync profili dalla directory
...

PROMPT OPERATIVI (operative_prompts):
- "Email primo contatto" — Obiettivo: generare email personalizzata
- "Follow-up WhatsApp" — Obiettivo: messaggio breve di follow-up
...

SEZIONI SISTEMA:
- Cockpit → genera outreach multicanale
- InReach → inbox email/WA/LI
- Contatti → gestione CRM importati
- Partner → directory WCA
...
```

Questa card viene rigenerata ogni volta che un agente viene creato/modificato o un prompt operativo cambia.

### Passo 2 — Context injection potenziato in `agent-execute`

Modificare `agent-execute/index.ts` per iniettare nel contesto di OGNI agente:

1. **Operative prompts** — come già fa `ai-assistant` (funzione `loadOperativePrompts`)
2. **Team roster** — query su `agents` per ottenere nome, ruolo, is_active, stats, clienti assegnati
3. **Propri clienti** — query su `client_assignments` filtrata per `agent_id`
4. **Task dei colleghi** — query su `agent_tasks` con status pending/running (visibilità cross-team)
5. **KB globale completa** — rimuovere il limit 5, caricare tutte le entries attive (sono max 40 card da 25 righe = ~1000 righe totali, gestibile)

Il prompt base includerà una riga:
```
Hai accesso COMPLETO a: tutti i tool operativi, KB globale, prompt operativi, team roster, 
storico attività dei colleghi, i tuoi clienti assegnati. Consulta questi dati prima di agire.
```

### Passo 3 — Accesso privilegiato Director

Per l'agente con ruolo `director` (Luca), aggiungere nel context injection:
- **Tutti i system_prompt** degli altri agenti (così vede come sono istruiti)
- **Tutti i prompt operativi** con dettaglio completo (obiettivo + procedura + criteri)
- Tool `MANAGEMENT_TOOLS` + `STRATEGIC_TOOLS` automaticamente assegnati

### Passo 4 — Hook `useSystemDirectory` per UI

Creare un hook che genera la "Directory Master" leggibile dalla UI (pagina Agenti o Settings), mostrando:
- Elenco agenti con ruolo, status, clienti, task
- Elenco prompt operativi con scope
- Elenco processi (hardcoded ma mantenuto in sync)

Questo serve sia per la visualizzazione umana che per la card KB auto-generata.

### Passo 5 — Prompt compatto per tutti gli agenti

Aggiungere nel template di OGNI agente (in `agentTemplates.ts`) un blocco standard:

```
ACCESSO SISTEMA:
- Consulta la "Directory Master" nella KB per vedere team, processi e prompt
- Usa search_memory per recuperare decisioni e contesto storico
- Usa get_team_status per stato real-time dei colleghi
- I tuoi clienti assegnati sono in client_assignments (tool: list_agent_tasks con filtro agent_id)
- Puoi vedere le attività di TUTTI i colleghi per coordinamento
```

## File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/agent-execute/index.ts` | Potenziare context injection: +operative_prompts, +team roster, +client assignments, +KB completa, +blocco Director |
| `src/data/agentTemplates.ts` | Aggiungere blocco "ACCESSO SISTEMA" a tutti i template |
| `src/hooks/useSystemDirectory.ts` | Nuovo — genera directory master per UI e KB |
| `src/components/agents/AgentSystemDirectory.tsx` | Nuovo — visualizza la directory nel pannello agenti |

## Ordine di esecuzione

1. Potenziare context injection in `agent-execute/index.ts`
2. Aggiornare template prompt in `agentTemplates.ts`
3. Creare hook + componente directory UI
4. Integrare nel pannello Agenti

