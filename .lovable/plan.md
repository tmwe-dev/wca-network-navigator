

# Fix Maschera Contatto: Layout, Spazi e Agente

## Problemi identificati

1. **Drawer troppo stretto** — `max-w-md` (28rem/448px) comprime i contenuti
2. **Tasto Modifica sotto la linguetta** — il pulsante Modifica compete con lo status nella stessa riga stretta
3. **Agente non assegnato** — l'auto-assign avviene solo alla prima attività (email, nota), non all'ingresso nel cockpit. I contatti nel cockpit non hanno ancora un record in `client_assignments`

## Modifiche

### 1. Allargare il drawer e migliorare spaziatura
**File:** `ContactRecordDrawer.tsx`
- Cambiare `max-w-md` → `max-w-xl` (36rem/576px)
- Aumentare padding interno da `p-5` a `p-6`

### 2. Riorganizzare header e pulsante Modifica
**File:** `ContactRecordFields.tsx`
- Separare la riga status/modifica: status a tutta larghezza, pulsante Modifica spostato in alto a destra con più spazio
- Aumentare larghezza label da `w-16` a `w-20` per evitare troncamento

### 3. Auto-assign agente all'apertura del drawer
**File:** `ContactRecordAgent.tsx`
- Quando il drawer si apre e non c'è assignment, eseguire auto-assign automatico (stesso meccanismo del Cockpit: trova il primo agente sales attivo e crea il record in `client_assignments`)
- Usa `useAssignClient` + `useAgents` internamente
- L'assegnazione è silenziosa e one-shot (non ri-assegna se già presente)

### 4. Fallback: auto-assign anche all'ingresso in cockpit_queue
**File:** `Cockpit.tsx`
- Nel ciclo che popola la coda cockpit, chiamare `autoAssign` anche al momento dell'inserimento in coda, non solo alla prima attività

## Dettagli tecnici

```text
ContactRecordAgent.tsx
├── useAssignmentMap() → check assignment
├── se mancante:
│   ├── useAgents() → trova sales agent
│   └── useAssignClient().mutate() → crea assignment
│       (useEffect one-shot al mount)
└── mostra agente assegnato (o appena assegnato)
```

## File coinvolti

| File | Modifica |
|------|----------|
| `ContactRecordDrawer.tsx` | `max-w-xl`, padding `p-6` |
| `ContactRecordFields.tsx` | Layout status/modifica, label `w-20` |
| `ContactRecordAgent.tsx` | Auto-assign con `useAssignClient` + `useAgents` |
| `Cockpit.tsx` | Auto-assign all'ingresso in coda (opzionale, rinforzo) |

