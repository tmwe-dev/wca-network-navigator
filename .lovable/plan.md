

# Auto-Assegnazione Agente per Zona al Momento dell'Ingresso nel Cockpit

## Situazione Attuale

- La tabella `agents` **non ha** campi per zona geografica o tipologia di clienti
- L'assegnazione (`client_assignments`) avviene solo alla prima attività nel Cockpit (handleDrop)
- `useSendToCockpit()` inserisce nella `cockpit_queue` senza assegnare agenti

## Cosa Cambia

L'agente viene assegnato **automaticamente nel momento in cui il contatto entra nel Cockpit** (non più alla prima attività), in base alla zona geografica del contatto.

## Piano

### 1. Aggiungere campo `territory_codes` alla tabella `agents`
Migrazione DB: aggiungere una colonna `territory_codes text[] default '{}'` alla tabella agents. Questo campo contiene i codici paese (es. `["IT", "FR", "DE"]`) che l'agente copre. Un agente senza territory_codes è "generico" e funziona come fallback.

### 2. Creare hook `useAutoAssignAgent`
Logica:
1. Dato un `country_code`, cerca l'agente attivo con quel codice in `territory_codes`
2. Se nessun match → assegna il primo agente con ruolo "Sales" o "Outreach"
3. Se nessun agente → skip (nessuna assegnazione)
4. Crea record in `client_assignments` con agente + manager (primo agente con ruolo contenente "Manager")

### 3. Integrare in `useSendToCockpit()`
Dopo l'inserimento nella `cockpit_queue`, per ogni contatto:
- Determinare il `country_code` dal sourceType/sourceId
- Chiamare la logica di auto-assign
- L'assegnazione avviene in modo silenzioso (no toast, solo creazione record)

### 4. UI AgentDetail: sezione "Zone di Competenza"
Aggiungere un campo multi-select con i codici paese nella pagina di dettaglio agente, per configurare i territori.

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | `ALTER TABLE agents ADD COLUMN territory_codes text[] DEFAULT '{}'` |
| `src/hooks/useAutoAssignAgent.ts` | **Nuovo** — logica assegnazione per zona |
| `src/hooks/useAgents.ts` | Aggiornare interfaccia Agent con `territory_codes` |
| `src/hooks/useCockpitContacts.ts` | Integrare auto-assign in `useSendToCockpit` |
| `src/components/agents/AgentDetail.tsx` | Aggiungere config zone di competenza |

### Flusso risultante

```text
1. Utente seleziona contatti → "Invia al Cockpit"
2. Sistema inserisce in cockpit_queue
3. Per ogni contatto: legge country_code → trova agente per zona → crea client_assignment
4. Contatto appare nel Cockpit con agente già assegnato sulla card
5. Nella pagina Agenti, l'agente vede i clienti nella sua lista
```

