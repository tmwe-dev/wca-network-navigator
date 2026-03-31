

# Fix Layout Cockpit + LinkedIn Pre-fill

## 4 modifiche

### 1. Margini laterali per linguette — `AppLayout.tsx`
- Cambiare `mx-[2px]` a `mx-[10px]` sul `<main>` per lasciare spazio alle linguette laterali
- Spostare il bottone IntelliFlow da `right-6` a `right-14` per non sovrapporsi alla linguetta destra e ai bottoni azione

### 2. Drop zones verticali — `ChannelDropZones.tsx`
- Cambiare layout da `grid grid-cols-2 gap-4 w-full max-w-[480px]` a `flex flex-col gap-2 w-full max-w-[140px]`
- Ridurre padding delle card da `p-8` a `p-3`, icone da `w-12 h-12` a `w-8 h-8`, rendere layout orizzontale (icona + label affiancati)

### 3. LinkedIn pre-fill — `AIDraftStudio.tsx` + `LinkedInDMDialog.tsx`
- In `AIDraftStudio`: passare `draft.body` (strippato dell'HTML) come prop `initialMessage` al `LinkedInDMDialog`
- In `LinkedInDMDialog`: accettare prop opzionale `initialMessage?: string` e usarla come valore iniziale dello `useState` del messaggio

### 4. Area draft piu' larga — `Cockpit.tsx`
- La colonna centrale (drop zones) si restringe grazie al layout verticale
- Ridurre larghezza fissa del pannello draft da `w-[400px]` a `w-[380px]` oppure usare `flex-1` per la colonna destra cosi' occupa lo spazio rimanente

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/layout/AppLayout.tsx` | `mx-[10px]` + IntelliFlow `right-14` |
| `src/components/cockpit/ChannelDropZones.tsx` | Layout verticale compatto |
| `src/components/cockpit/AIDraftStudio.tsx` | Passare `draft.body` a LinkedInDMDialog |
| `src/components/workspace/LinkedInDMDialog.tsx` | Prop `initialMessage` pre-compilata |
| `src/pages/Cockpit.tsx` | Ridurre/adattare larghezze colonne |

