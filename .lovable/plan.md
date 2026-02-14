
# Riposizionamento Directory Count e Switch "Solo Directory"

## Due modifiche

### 1. Directory count sulla DESTRA della card paese (bold + icona)

Attualmente il conteggio directory e' inline sotto il nome del paese, poco visibile. Viene spostato nell'area destra della card (dove ci sono Mail/Phone/Users), come primo elemento prominente.

- Rimuovere il badge `FolderDown {cCount} in directory` dalla sezione status sotto il nome (righe 320-324)
- Aggiungerlo nell'area destra (righe 338-356), PRIMA delle stats contatti, come numero bold con icona `FolderDown`:
  - Sempre visibile quando `hasDirectoryScan && cCount > 0`
  - Stile: `text-sm font-bold font-mono` con colore sky, icona `FolderDown` accanto
  - Visibile anche quando `pCount === 0` (attualmente l'area destra appare solo se `pCount > 0`)
- La condizione `pCount > 0` viene allargata a `(pCount > 0 || cCount > 0)` per mostrare l'area destra anche quando c'e' solo la directory

### 2. Switch "Solo Directory" nel pannello sinistro, sopra le bandiere

Lo switch "Solo Directory" attualmente si trova dentro il tab Scarica (pannello destro, ActionPanel). Viene spostato/duplicato nel pannello sinistro della CountryGrid.

- Aggiungere una prop `directoryOnly` e `onDirectoryOnlyChange` a `CountryGrid`
- Posizionare lo switch nella riga tra le bandiere selezionate e la lista paesi, allineato a destra
- Lo stato `directoryOnly` viene gestito in `Operations.tsx` e passato sia a `CountryGrid` (per la visualizzazione) che a `ActionPanel` (per la logica di download)

### File modificati

- **`src/components/download/CountryGrid.tsx`**:
  - Rimuovere badge directory dalla sezione status sotto il nome
  - Aggiungere numero directory bold sulla destra della card
  - Aggiungere props `directoryOnly` / `onDirectoryOnlyChange`
  - Aggiungere switch "Solo Directory" sopra la lista, accanto alle bandiere selezionate
  - Importare `Switch` da ui e `FolderDown` (gia' importato)

- **`src/pages/Operations.tsx`**:
  - Aggiungere stato `directoryOnly` con `useState(false)`
  - Passare `directoryOnly` e `onDirectoryOnlyChange` a `CountryGrid`
  - Passare `directoryOnly` a `ActionPanel` come prop

- **`src/components/download/ActionPanel.tsx`**:
  - Accettare `directoryOnly` come prop invece di stato locale
  - Rimuovere lo stato `useState` locale per `directoryOnly`
