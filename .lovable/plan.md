

## Problema: email indirizzate all'azienda invece che al contatto

### Diagnosi

Ho verificato il flusso completo e trovato **3 cause concatenate**:

1. **Le attività vengono create senza `selected_contact_id`** — il dialog `AssignActivityDialog` non include mai la selezione del contatto. Quindi tutte le attività arrivano al Workspace senza un contatto associato.

2. **L'edge function `generate-email` accetta di generare senza contatto** — quando `contact` è `null`, riga 416 dice letteralmente all'AI: *"indirizzare all'azienda usando il nome"*. Risultato: "Cara società XY".

3. **Nessuna UI per scegliere il contatto** — nel Workspace, non c'è modo di selezionare tra i contatti disponibili di un partner prima di generare.

### Soluzione in 3 parti

#### 1. Edge Function: rifiutare generazione senza contatto

**File: `supabase/functions/generate-email/index.ts`**
- Dopo aver risolto partner e contact, se `contact` è `null` (e `sourceType === "partner"`), restituire errore 422 `"no_contact"` con messaggio chiaro
- Rimuovere il fallback riga 416 che dice "indirizzare all'azienda"
- Quando `contact` esiste, rendere il prompt ancora più esplicito: "Rivolgiti SEMPRE alla persona, MAI all'azienda nel saluto"

#### 2. Workspace: aggiungere selezione contatto

**File: `src/components/workspace/ContactListPanel.tsx`** (o nuovo componente `ContactPicker`)
- Quando l'utente clicca su un'attività che ha un partner con contatti ma `selected_contact_id` è null, mostrare un piccolo picker/dropdown con i contatti disponibili
- Chiamare `useUpdateActivity` per salvare il `selected_contact_id` scelto
- Se il partner ha un solo contatto, auto-selezionarlo

**File: `src/components/workspace/EmailCanvas.tsx`**
- Prima del bottone "Genera", mostrare il contatto selezionato
- Se mancante, mostrare avviso con link per selezionarne uno
- Bloccare la generazione se non c'è contatto

#### 3. Batch generation: skip intelligente

**File: `src/pages/Workspace.tsx`**
- In `handleGenerateAll`, oltre al filtro `withEmail`, aggiungere filtro `withContact` 
- Le attività senza contatto selezionato vengono escluse con toast riepilogativo: "X partner esclusi (nessun contatto selezionato)"
- Per i partner con un solo contatto, auto-assegnare il contatto prima di generare

### Dettaglio tecnico del ContactPicker

Nuovo componente inline che appare nella lista attività o nell'EmailCanvas:
- Query `partner_contacts` per il `partner_id` dell'attività
- Se 1 contatto → auto-select + update activity
- Se 2+ contatti → dropdown con nome, ruolo, email
- Se 0 contatti → badge "Nessun contatto disponibile"
- Al cambio selezione → `supabase.from("activities").update({ selected_contact_id })` 

### File coinvolti
- `supabase/functions/generate-email/index.ts` — validazione contatto + prompt fix
- `src/components/workspace/EmailCanvas.tsx` — UI contatto + blocco generazione
- `src/components/workspace/ContactListPanel.tsx` — indicatore contatto nella lista
- `src/pages/Workspace.tsx` — filtro batch
- Nuovo: `src/components/workspace/ContactPicker.tsx` — picker contatto riusabile

