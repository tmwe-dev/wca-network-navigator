

# Report Visuale Capacità Agenti AI

## Obiettivo
Creare una nuova pagina `/v2/agent-capabilities` con un report visuale che mostri per ogni agente: tool assegnati, tool effettivamente usati (da agent_tasks), e gap operativi rispetto al set completo di 68 tool backend.

## Architettura

### 1. Nuova pagina: `src/v2/ui/pages/AgentCapabilitiesPage.tsx`
Componente principale con:
- **Header** con titolo "Capacità Agenti AI" e contatori riassuntivi (totale tool backend, agenti attivi)
- **Griglia agenti** con tabs orizzontali (stesso pattern di AgentStatusPanel) per selezionare l'agente
- **Dettaglio agente selezionato** con 3 sezioni:

```text
┌─────────────────────────────────────────────────┐
│  [Tab Luca] [Tab Marco] [Tab Robin] [Tab ...]   │
├─────────────────────────────────────────────────┤
│  🧠 Luca · Director                             │
│                                                  │
│  ✅ Tool Assegnati (14/68)  ████████░░░░  21%    │
│  ─────────────────────────────                   │
│  search_partners  get_partner_detail  ...        │
│                                                  │
│  📊 Utilizzo (da agent_tasks)                    │
│  screening: 59 task · analysis: 3 task           │
│                                                  │
│  ⚠️ Gap Operativi (54 tool mancanti)             │
│  create_campaign · schedule_email · ...          │
│  Categorie mancanti: Outreach, Download, ...     │
└─────────────────────────────────────────────────┘
```

### 2. Hook: `src/v2/hooks/useAgentCapabilities.ts`
- Query `agents` per `assigned_tools` e `stats`
- Query `agent_tasks` aggregata per agente (count per task_type e status)
- Calcolo gap confrontando `assigned_tools` vs lista completa `ALL_OPERATIONAL_TOOLS + MANAGEMENT_TOOLS + STRATEGIC_TOOLS`
- Categorizzazione tool mancanti per area (Partner, Network, Outreach, CRM, etc.)

### 3. Rotta
Aggiungere in `src/v2/routes.tsx`:
- Lazy import `AgentCapabilitiesPage`
- Route `agent-capabilities` sotto authenticated layout

### File modificati

| File | Modifica |
|------|----------|
| `src/v2/ui/pages/AgentCapabilitiesPage.tsx` | Nuovo — pagina report |
| `src/v2/hooks/useAgentCapabilities.ts` | Nuovo — hook dati |
| `src/v2/routes.tsx` | +3 righe per rotta |
| `src/lib/queryKeys.ts` | +1 chiave per agents.capabilities |

### Dettagli tecnici
- I 68 tool backend sono quelli estratti da `toolDefinitions.ts` (già censiti)
- Le categorie tool (Partner, Network, Ricerca, CRM, Outreach, Agenda, Sistema, Management, Strategic) derivano da `roles.ts`
- Progress bar colorata: <30% rosso, 30-60% giallo, >60% verde
- Badge per ruolo agente con colore dal `AGENT_ROLES` esistente
- Nessuna migrazione DB necessaria — tutto read-only su tabelle esistenti

