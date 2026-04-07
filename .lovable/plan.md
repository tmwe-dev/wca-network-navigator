

# Checkbox "Seleziona tutti / Deseleziona tutti" sopra ogni elenco selezionabile

## Cosa cambia

Aggiungere un checkbox nella riga dell'header (sopra l'elenco, nella barra colonne o nella barra info) in tutte le liste selezionabili. Quando premuto, seleziona tutti gli elementi visibili; se già tutti selezionati, deseleziona tutti.

## Liste coinvolte

1. **CRM Contatti** (`ContactListPanel.tsx`) — nella riga header ordinabile (riga 311-331), sostituire il `<div />` vuoto nella prima cella con un `<Checkbox>` che usa `selection.toggleAll` / `selection.isAllSelected`. Il `useSelection` attualmente riceve `[]` come items — va aggiornato per passare `contacts` così che `selectAll` e `isAllSelected` funzionino correttamente.

2. **Network Partners** (`PartnerListPanel.tsx`) — usa `selectedIds` come `Set<string>` manuale (non `useSelection`). Aggiungere un checkbox nell'header della lista che seleziona/deseleziona tutti i `partners` caricati.

3. **CRM Biglietti da Visita** (`BusinessCardsHub.tsx`) — aggiungere checkbox nell'header sopra l'elenco dei biglietti.

4. **Attività** (`ActivitiesTab.tsx`) — già usa `useSelection` con `toggleAll`/`isAllSelected`. Aggiungere il checkbox nell'header della lista se non presente.

## Dettagli tecnici

- **`ContactListPanel.tsx`**: cambiare `useSelection([])` → `useSelection(contacts)` per avere `isAllSelected` e `toggleAll` funzionanti. Nella riga header grid (riga 315), sostituire `<div />` con `<Checkbox checked={selection.isAllSelected} onCheckedChange={selection.toggleAll} />`.

- **`PartnerListPanel.tsx`**: aggiungere un checkbox nell'header che fa `setSelectedIds(new Set(partners.map(p => p.id)))` o `setSelectedIds(new Set())`.

- **`BusinessCardsHub.tsx`**: stesso pattern — checkbox nell'header della lista.

- **`ActivitiesTab.tsx`**: aggiungere checkbox prima della lista.

## File modificati

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactListPanel.tsx` | `useSelection(contacts)` + Checkbox nell'header grid |
| `src/components/operations/PartnerListPanel.tsx` | Checkbox select all/deselect all nell'header |
| `src/components/contacts/BusinessCardsHub.tsx` | Checkbox select all/deselect all nell'header |
| `src/components/agenda/ActivitiesTab.tsx` | Checkbox select all/deselect all nell'header |

Nessuna migrazione DB.

