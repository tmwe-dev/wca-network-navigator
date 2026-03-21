

# Piano: Integrazione Agenti nel Mission Control

## Stato attuale

Mission Control (`SuperHome3D.tsx`) e' una dashboard statica con 4 card di navigazione, contatori aggregati, e un prompt AI generico. Gli 11 agenti esistono nel DB con tool-calling reale via `agent-execute` (1263 righe, 42+ tool), ma **non sono visibili ne' utilizzabili dalla Home**. Sono confinati in `/agent-chat` e `/agents`.

L'infrastruttura agenti e' gia' solida:
- `agent-execute` ha loop di tool-calling reale (10 iterazioni max)
- 6 template con assigned_tools specifici per ruolo
- `agent_tasks` nel DB per tracking task
- Management tools per Luca (create_agent_task, get_team_status, etc.)

## Cosa manca

1. **Nessun briefing operativo** — la Home non chiede all'AI "cosa sta succedendo?"
2. **Nessuna visibilita' sugli agenti** — non si vede chi sta lavorando, chi e' idle
3. **Nessun ponte Home → Agenti** — non posso dire "Luca, fammi un report" dalla Home
4. **Il prompt della Home chiama `ai-assistant`, non gli agenti** — sono due mondi separati

## Soluzione: 3 componenti + 1 edge function

### 1. Edge function `daily-briefing`

Query aggregata sul DB reale:
- `download_jobs`: completati/falliti/attivi ultime 24h
- `partners`: count senza email, senza profilo
- `activities`: in scadenza oggi, overdue
- `agent_tasks`: per agente, status running/completed/pending
- `email_campaign_queue`: pending/sent

Passa i dati al LLM (Gemini Flash) con prompt: "Genera briefing operativo in italiano, max 5 punti, con azioni suggerite."

Risposta strutturata:
```json
{
  "summary": "markdown del briefing",
  "actions": [
    { "label": "Deep Search top 10", "agentName": "Imane", "prompt": "..." },
    { "label": "Report team", "agentName": "Luca", "prompt": "..." }
  ],
  "agentStatus": [
    { "name": "Luca", "emoji": "🎯", "activeTasks": 0, "completedToday": 3 }
  ]
}
```

### 2. Componente `OperativeBriefing.tsx`

Card glassmorphism che mostra il briefing AI con:
- Markdown renderizzato (punti prioritari)
- Pulsanti azione che invocano direttamente l'agente giusto via `agent-execute`
- Ogni azione specifica quale agente la esegue (es. "Imane: Deep Search" → crea task per Imane)

### 3. Componente `AgentStatusPanel.tsx`

Pannello orizzontale sotto le nav cards:
- Query `agent_tasks` raggruppata per `agent_id`
- Mostra emoji + nome + stato (idle/working/N task in corso)
- Click su agente → naviga a `/agent-chat` con quell'agente pre-selezionato
- Badge per task completati oggi

### 4. Aggiornamento `SuperHome3D.tsx`

Layout aggiornato:
```text
Greeting + AI Prompt (con contesto briefing)
Briefing Operativo (daily-briefing)
Pannello Agenti (agent status live)
Nav Cards (4 aree)
Download attivi (esistente)
Stato sistema (esistente)
```

### 5. Aggiornamento `HomeAIPrompt.tsx`

- Smart prompts derivati dal briefing (non hardcoded)
- Possibilita' di indirizzare il messaggio a un agente specifico: se l'utente scrive "@Luca ..." o "@Robin ...", il prompt viene inoltrato a `agent-execute` con quell'agent_id invece di `ai-assistant`
- Fallback: se nessun agente menzionato, usa `ai-assistant` come oggi

## File da creare/modificare

| File | Azione |
|------|--------|
| `supabase/functions/daily-briefing/index.ts` | Creare — query DB + LLM briefing |
| `src/hooks/useDailyBriefing.ts` | Creare — hook con cache 15min |
| `src/components/home/OperativeBriefing.tsx` | Creare — card briefing con azioni |
| `src/components/home/AgentStatusPanel.tsx` | Creare — stato live agenti |
| `src/pages/SuperHome3D.tsx` | Modificare — integrare i 2 componenti |
| `src/components/home/HomeAIPrompt.tsx` | Modificare — smart prompts dinamici + routing @agente |

## Flusso utente risultante

1. Apro la Home → briefing si carica automaticamente
2. Vedo "47 partner senza email — suggerisco Deep Search top 10"
3. Clicco il pulsante → crea task per Imane via `agent-execute`
4. Sotto, vedo che Imane passa da "idle" a "1 task in corso"
5. Scrivo nel prompt "@Luca report del team" → va direttamente a Luca
6. Luca risponde con lo stato di tutti gli agenti usando `get_team_status`

