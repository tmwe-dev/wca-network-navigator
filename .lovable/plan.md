

# Assegnazione Agente + Manager su Prima Attività

## Concetto

Quando si esegue la prima operazione su un contatto/partner (email, LinkedIn, chiamata, ecc.), il sistema lo assegna automaticamente a un **agente di vendita** e a un **team member manager**. Da quel momento il contatto entra nel "circuito d'attesa" con un responsabile operativo (agente) e uno strategico (manager).

## Cosa serve

### 1. Database — Nuova tabella `client_assignments`

```sql
CREATE TABLE public.client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,          -- partner/contact/prospect ID
  source_type TEXT NOT NULL DEFAULT 'partner',
  agent_id UUID NOT NULL,           -- → agents.id
  manager_id UUID,                  -- → team_members.id (opzionale)
  assigned_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL
);
```
Con RLS per `user_id = auth.uid()`. Questa tabella è leggera, 1 riga per cliente assegnato.

### 2. Auto-assegnazione alla prima attività

**File: `src/pages/Cockpit.tsx`** — nel `handleDrop` e nel `BulkActionMenu`, dopo la creazione dell'attività:
- Controllare se esiste già un record in `client_assignments` per quel `source_id`
- Se **no**: crearlo automaticamente con l'agente di default (primo agente attivo con ruolo `sales` o `outreach`, configurabile)
- Se **sì**: non fare nulla (già assegnato)

**Nuovo hook: `src/hooks/useClientAssignments.ts`**
- `useClientAssignment(sourceId)` → restituisce agente + manager assegnati
- `useAssignClient()` → mutation per assegnare
- `useAgentClients(agentId)` → lista clienti assegnati a un agente

### 3. Card del Cockpit — mostrare agente e manager

**File: `src/components/cockpit/CockpitContactCard.tsx`**
- Aggiungere props opzionali `assignedAgent?: { name, avatar }` e `assignedManager?: { name }`
- Sotto le icone canale, mostrare:
  - Mini-avatar dell'agente (cerchietto 16px con immagine da `agentAvatars.ts`) + nome abbreviato
  - Icona manager (👔) + nome abbreviato, se presente
- Se non ancora assegnato: nessuna icona (la card è "libera")

### 4. Pagina Agenti — tab "Clienti Assegnati"

**File: `src/components/agents/AgentDetail.tsx`**
- Aggiungere un tab o sezione "Clienti" nel dettaglio agente
- Query `client_assignments` filtrata per `agent_id`
- Lista compatta: nome azienda, contatto, lead_status, ultima attività
- Click → apre il contatto nel Cockpit o nel CRM

### 5. Wiring nel Cockpit

**File: `src/pages/Cockpit.tsx`** e **`ContactStream.tsx`**
- Caricare le `client_assignments` per tutti i contatti in coda (una singola query)
- Passare `assignedAgent` e `assignedManager` alla `CockpitContactCard`

## File coinvolti

| File | Azione |
|------|--------|
| Migrazione DB | Nuova tabella `client_assignments` + RLS |
| `src/hooks/useClientAssignments.ts` | Nuovo — hook CRUD assegnazioni |
| `src/components/cockpit/CockpitContactCard.tsx` | Modifica — mostra avatar agente + manager |
| `src/components/cockpit/ContactStream.tsx` | Modifica — passa dati assegnazione alle card |
| `src/pages/Cockpit.tsx` | Modifica — auto-assign al primo drop/attività |
| `src/components/cockpit/BulkActionMenu.tsx` | Modifica — auto-assign in batch |
| `src/components/agents/AgentDetail.tsx` | Modifica — sezione clienti assegnati |

## Flusso risultante

```text
1. Utente trascina contatto su LinkedIn (prima volta)
2. Sistema crea attività + assegna automaticamente agente Sales
3. Card mostra: mini-avatar agente + badge manager
4. Nella pagina Agenti → agente vede il cliente nella sua lista
5. Agente segue il cliente nel circuito fino a conversione
```

