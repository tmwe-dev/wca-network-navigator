

# Piano: Sezione Agenti Virtuali

## Visione

Creare un nuovo ambiente **Agenti** (`/agents`) nella sidebar, dove l'utente configura, monitora e gestisce agenti AI autonomi. Ogni agente ha identità, voce ElevenLabs, knowledge base, prompt personalizzabili, tool assegnati e compiti schedulati. Gli agenti operano sul database esistente usando gli stessi tool dell'ai-assistant attuale, senza modificare il motore sottostante.

## Architettura

```text
┌─────────────────────────────────────────────────┐
│                   /agents                        │
│  ┌──────────┐  ┌─────────────────────────────┐  │
│  │ Lista    │  │  Dettaglio Agente           │  │
│  │ Agenti   │  │  ┌─ Identità & Voce        │  │
│  │          │  │  ├─ Prompt Editor           │  │
│  │ + Nuovo  │  │  ├─ Knowledge Base          │  │
│  │          │  │  ├─ Tool Assegnati          │  │
│  │ Outreach │  │  ├─ Compiti / Schedule      │  │
│  │ Analisi  │  │  ├─ Log Attività            │  │
│  │ Ricerca  │  │  └─ Chat Diretta (voce)     │  │
│  │ Account  │  │                             │  │
│  │ Strategy │  └─────────────────────────────┘  │
│  └──────────┘                                   │
└─────────────────────────────────────────────────┘
```

## Tipologie di Agenti Predefiniti

1. **Outreach Agent** -- Contatta partner via email, verifica holding pattern, programma follow-up, escalation a telefonate
2. **Download/Sync Agent** -- Gestisce download WCA, verifica completezza directory, retry profili mancanti
3. **Research Agent** -- Analizza LinkedIn, Report Aziende, decide quali aziende importare, crea elenchi di lavoro
4. **Account Manager Agent** -- Monitora clienti attivi, verifica utilizzo servizi, propone promozioni per ri-engagement
5. **Strategy Agent** -- Analizza copertura mondiale, istruisce gli altri agenti, ottimizza priorità di contatto

## Database (2 nuove tabelle)

### Tabella `agents`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | |
| user_id | uuid | RLS per utente |
| name | text | Nome dell'agente |
| role | text | outreach, download, research, account, strategy |
| avatar_emoji | text | Emoji identificativa |
| system_prompt | text | Prompt personalizzabile |
| knowledge_base | jsonb | Array di documenti/testi di riferimento |
| elevenlabs_agent_id | text | ID agente ElevenLabs (opzionale) |
| elevenlabs_voice_id | text | ID voce ElevenLabs |
| assigned_tools | jsonb | Array di nomi tool abilitati |
| schedule_config | jsonb | Configurazione esecuzione (cron, trigger, manuale) |
| is_active | boolean | Attivo/Disattivo |
| stats | jsonb | Contatori (tasks completati, email inviate, ecc.) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Tabella `agent_tasks`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | |
| agent_id | uuid FK | Riferimento agente |
| user_id | uuid | RLS |
| task_type | text | download, outreach, research, analysis, call |
| description | text | Descrizione del compito |
| target_filters | jsonb | Filtri target (paese, status, ecc.) |
| status | text | pending, running, completed, failed, paused |
| result_summary | text | Riepilogo risultato |
| execution_log | jsonb | Log dettagliato esecuzione |
| scheduled_at | timestamptz | Quando eseguire |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| created_at | timestamptz | |

RLS: `auth.uid() = user_id` su entrambe.

## File da creare (nessun file esistente viene toccato)

### Frontend
- **`src/pages/Agents.tsx`** -- Pagina principale con lista agenti + dettaglio
- **`src/components/agents/AgentCard.tsx`** -- Card agente nella lista
- **`src/components/agents/AgentDetail.tsx`** -- Pannello dettaglio con tabs
- **`src/components/agents/AgentPromptEditor.tsx`** -- Editor prompt con preview
- **`src/components/agents/AgentToolSelector.tsx`** -- Selezione tool abilitati (checkbox dei 42 tool esistenti)
- **`src/components/agents/AgentKnowledgeBase.tsx`** -- Gestione documenti KB dell'agente
- **`src/components/agents/AgentTaskList.tsx`** -- Lista compiti assegnati con stato
- **`src/components/agents/AgentVoiceConfig.tsx`** -- Configurazione voce ElevenLabs (agent_id + voice_id)
- **`src/components/agents/AgentChat.tsx`** -- Chat diretta con l'agente (testo + voce ElevenLabs)
- **`src/components/agents/CreateAgentDialog.tsx`** -- Dialog creazione nuovo agente con template predefiniti
- **`src/hooks/useAgents.ts`** -- Hook CRUD agenti
- **`src/hooks/useAgentTasks.ts`** -- Hook CRUD task agenti

### Backend
- **`supabase/functions/agent-execute/index.ts`** -- Edge function che esegue un task per conto di un agente. Riceve agent_id + task_id, carica il prompt e i tool dell'agente, esegue la logica usando lo stesso motore AI dell'ai-assistant (riuso pattern tool-calling), salva risultati in agent_tasks.

### Routing
- Aggiunta route `/agents` in `App.tsx`
- Aggiunta voce "Agenti" nella sidebar con icona `Bot`

## Flusso Operativo

1. L'utente crea un agente (es. "Marco - Outreach Italia") selezionando un template predefinito
2. Personalizza il prompt, assegna tool specifici, collega voce ElevenLabs
3. Assegna compiti: "Contatta tutti i partner italiani senza email con deep search, poi genera email di presentazione"
4. L'agente esegue il compito chiamando `agent-execute`, che usa gli stessi tool dell'ai-assistant
5. L'utente monitora il progresso in tempo reale nel log del task
6. Può parlare direttamente con l'agente tramite la chat vocale integrata (ElevenLabs Conversational AI)

## Integrazione ElevenLabs

- **Voce TTS**: Usa l'edge function `elevenlabs-tts` esistente per leggere le risposte dell'agente
- **Agente Conversazionale**: Usa `@elevenlabs/react` con `useConversation` per chat vocale bidirezionale, collegando l'`elevenlabs_agent_id` configurato dall'utente
- **Token Server-Side**: Nuova edge function `elevenlabs-conversation-token` per generare token sicuri

## Risultato Atteso

- Nuova sezione "Agenti" nella sidebar con interfaccia premium glassmorphism
- 5 template agenti predefiniti pronti all'uso
- Ogni agente ha prompt editabile, tool selezionabili, voce configurabile
- Gli agenti eseguono task reali sul database usando l'infrastruttura esistente
- Chat vocale bidirezionale con ogni agente tramite ElevenLabs
- Zero modifiche ai file esistenti -- tutto il codice è nuovo e additivo

## Dettagli Tecnici

- L'edge function `agent-execute` importa la stessa logica di tool-calling dell'`ai-assistant` ma con prompt e tool filtrati per agente
- I task vengono eseguiti on-demand (l'utente clicca "Esegui") o schedulati tramite pg_cron
- Il log di esecuzione è in tempo reale tramite polling su `agent_tasks.execution_log`
- La KB dell'agente viene iniettata nel system prompt come contesto aggiuntivo

