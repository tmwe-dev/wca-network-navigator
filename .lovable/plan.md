
# Piano: Seleziona tutto e cancella con un click

## Obiettivo

Aggiungere un checkbox "Seleziona tutto" nella barra dei risultati che seleziona tutte le attivita filtrate, permettendo di cancellarle con un solo click senza dover confermare due volte.

## Modifiche in `ActivitiesTab.tsx`

### 1. Stato selezione

Aggiungere uno stato `selectedIds` (Set di stringhe) per tracciare le attivita selezionate.

### 2. Checkbox "Seleziona tutto" nella barra risultati

Nella riga che mostra il conteggio risultati, aggiungere:
- Un Checkbox che seleziona/deseleziona tutte le attivita filtrate
- Label: "Seleziona tutto (N)"
- Quando attivo, popola `selectedIds` con tutti gli ID filtrati
- Quando disattivato, svuota `selectedIds`

### 3. Checkbox per riga

Aggiungere un Checkbox a sinistra di ogni `ActivityRow` per selezione individuale.

### 4. Barra azioni bulk

Quando ci sono elementi selezionati, mostrare:
- Contatore: "N selezionate"
- Pulsante "Cancella selezionate" (destructive) che apre il dialog di conferma solo per le selezionate
- Il pulsante "Cancella filtrate" attuale rimane ma opera sulle filtrate (non sulle selezionate)

### 5. Logica cancellazione

- "Cancella selezionate": cancella solo gli ID in `selectedIds`
- Dopo la cancellazione, svuota `selectedIds`

## Dettagli tecnici

| Elemento | Dettaglio |
|----------|-----------|
| File modificato | `src/components/agenda/ActivitiesTab.tsx` |
| Nuovo import | `Checkbox` da `@/components/ui/checkbox` |
| Nuovo stato | `selectedIds: Set<string>` |
| Props ActivityRow | Aggiunge `selected: boolean` e `onToggleSelect: () => void` |

### Flusso

```text
Filtri attivi --> [x] Seleziona tutto (47) --> [Cancella selezionate (47)]
                                                      |
                                                Dialog conferma --> Cancella
```
