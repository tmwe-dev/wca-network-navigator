

# Menu azioni (⋮) su tutte le card + Verifica sincronizzazione circuito di attesa

## Situazione attuale — Menu azioni a tre pallini

| Vista | Ha il menu ⋮? |
|-------|---------------|
| Cockpit — ContactStream (card e list) | ✅ `ContactActionMenu` |
| Network — PartnerDetailCompact (contatti del partner) | ✅ `PartnerContactActionMenu` |
| **CRM Contatti — ContactCard** | ❌ MANCA |
| **CRM Biglietti — BusinessCardsHub** | ❌ MANCA |
| **CockpitContactListItem** (riga compatta cockpit) | ❌ MANCA (è nel ContactStream wrapper, non nella riga stessa) |
| **UnifiedContactRow** (componente shared) | ❌ MANCA |

## Situazione attuale — Circuito di attesa

Il flusso `useTrackActivity` escalda correttamente `lead_status: new → contacted` per:
- Partner (tabella `partners`)
- Contatti importati (tabella `imported_contacts`)
- Biglietti da visita (tabella `business_cards`)

Il filtro `holdingPattern` in `useContactsPaginated` usa `interaction_count > 0` per determinare chi è "in circuito". **Problema potenziale**: `useTrackActivity` aggiorna `lead_status` ma non incrementa `interaction_count` direttamente — `interaction_count` viene da `contact_interactions` tramite un conteggio separato. Devo verificare che il conteggio sia coerente.

## Piano di intervento

### Step 1: Aggiungere il menu ⋮ alla ContactCard del CRM
- Importare `ContactActionMenu` dal cockpit (o creare un wrapper per contatti importati che adatta l'interfaccia)
- Il `ContactActionMenu` attuale accetta un `CockpitContact` — serve un adattatore che mappa `imported_contact` → `CockpitContact`
- Posizionare il menu nella **Col 7** (dove c'è la lente), aggiungendo i tre pallini accanto alla lente

### Step 2: Aggiungere il menu ⋮ ai biglietti da visita (BusinessCardsHub)
- Nelle card compact/expanded dei biglietti, aggiungere lo stesso menu azioni
- Adattare i dati del biglietto al formato richiesto dal menu

### Step 3: Aggiungere il menu ⋮ alla CockpitContactListItem
- Attualmente il menu appare solo nel wrapper `ContactStream` su hover — va messo direttamente nella riga

### Step 4: Aggiungere il menu ⋮ alla UnifiedContactRow
- Componente shared usato potenzialmente in più punti — aggiungere un prop opzionale per il menu azioni

### Step 5: Verifica sincronizzazione circuito di attesa
- Controllare che `interaction_count` in `imported_contacts` venga aggiornato quando `useTrackActivity` crea un record in `contact_interactions`
- Verificare che la query del filtro `holdingPattern` sia coerente con i dati scritti
- Controllare che i contatti lavorati oggi (`useWorkedToday`) vengano effettivamente esclusi dalla lista quando il filtro "fuori circuito" è attivo
- Se necessario, aggiungere un trigger SQL che incrementa `interaction_count` sulla tabella `imported_contacts` quando viene inserita una riga in `contact_interactions`

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactCard.tsx` | Aggiungere import e rendering del menu ⋮ nella Col 7 accanto alla lente |
| `src/components/contacts/BusinessCardsHub.tsx` | Aggiungere menu ⋮ su ogni card biglietto da visita |
| `src/components/cockpit/CockpitContactListItem.tsx` | Aggiungere menu ⋮ inline nella riga |
| `src/components/shared/UnifiedContactRow.tsx` | Aggiungere prop `actionMenu` opzionale |
| `src/components/cockpit/ContactActionMenu.tsx` | Eventuale refactor per accettare un formato contatto generico (o creare un adattatore) |
| Migration SQL (se necessario) | Trigger per sincronizzare `interaction_count` con le inserzioni in `contact_interactions` |

