

## Piano: Multi-selezione + Deep Search & Alias nel Cockpit

### Stato attuale

Il Cockpit usa **dati demo hardcoded** (8 contatti fittizi). Non c'è multi-selezione: ogni card si può solo trascinare singolarmente. Non ci sono azioni bulk (Deep Search, Alias).

### Cosa costruire

#### 1. Multi-selezione nelle card/lista
- Aggiungere **checkbox** su ogni `CockpitContactCard` e `CockpitContactListItem`
- Click sulla card = toggle selezione (senza impedire il drag)
- Usare l'hook esistente `useSelection` per gestire lo stato
- Header ContactStream: mostrare **"Seleziona tutti" / conteggio selezionati** + bottoni azione bulk
- Il drag di una card selezionata trascina **tutti i selezionati** (drag multiplo)

#### 2. Barra azioni bulk (sopra la lista contatti)
Quando `selectedIds.size > 0`, mostrare una barra con:
- **Deep Search** (icona Search) — lancia `useDeepSearch().start(ids)` sui selezionati
- **Genera Alias** — invoca `generate-aliases` per i selezionati
- **Conteggio** — "3 selezionati"
- **Deseleziona tutti**

#### 3. Azioni singole sulla card
I bottoni già presenti sulla card (Search, Sparkles) diventano funzionali:
- **Search** → Deep Search singolo
- **Sparkles** → Genera Alias singolo

#### 4. Drag multiplo verso le Drop Zones
- Quando si trascina una card selezionata, `draggedContactId` diventa l'array di tutti i selezionati
- `ChannelDropZones.onDrop` riceve l'array di ID e genera messaggi in sequenza (o il primo + coda)
- Indicatore visivo nella drop zone: "3 contatti" invece di "Rilascia qui"

#### 5. Integrazione con il sistema Deep Search globale
- Connettere al `DeepSearchContext` già esistente nel layout (`useDeepSearch`)
- Il Cockpit attualmente usa dati demo, quindi Deep Search/Alias opereranno solo quando i dati saranno reali (imported_contacts o partners). Per ora, le azioni saranno **cablate ma mostreranno un toast** "Disponibile con dati reali" finché il Cockpit non sarà connesso al DB

### File da modificare

1. **`src/pages/Cockpit.tsx`** — Aggiungere stato selezione (`useSelection`), passare `selectedIds`/`toggle` a ContactStream, gestire drag multiplo
2. **`src/components/cockpit/ContactStream.tsx`** — Ricevere props selezione, aggiungere header con "Seleziona tutti" + barra azioni bulk (Deep Search, Alias)
3. **`src/components/cockpit/CockpitContactCard.tsx`** — Aggiungere checkbox, evidenziazione card selezionata (bordo primario), click per toggle
4. **`src/components/cockpit/CockpitContactListItem.tsx`** — Stessa logica checkbox + highlight per la vista lista
5. **`src/components/cockpit/ChannelDropZones.tsx`** — Supportare array di ID nel drag multiplo, mostrare conteggio nel drop indicator

### Dettagli tecnici

```text
ContactStream
├── Header: [checkbox Tutti] [3 selezionati] [🔍 Deep Search] [✨ Alias] [✕ Deseleziona]
├── Card View
│   └── CockpitContactCard (+ checkbox, selected border, drag=multi)
└── List View
    └── CockpitContactListItem (+ checkbox, selected bg, drag=multi)
```

- La selezione usa `useSelection` da `src/hooks/useSelection.ts` (già esistente)
- Deep Search: `useDeepSearch().start(selectedIds)` dal context globale
- Alias: invocazione diretta di `supabase.functions.invoke("generate-aliases", { body: { contactIds: [...] } })`
- Drag multiplo: `onDragStart` passa `Set<string>` dei selezionati al parent; `ChannelDropZones` mostra "N contatti" e chiama `onDrop` per ciascuno

