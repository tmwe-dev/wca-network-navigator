

# Fix: Filtri Ranking + Cerca Aziende

## Problema
Dopo aver selezionato Milano come provincia e applicato i filtri di ranking ATECO, il pulsante "Cerca Aziende" resta disattivato perche' richiede codici ATECO selezionati manualmente. I filtri di ranking nascondono solo visivamente le categorie nell'albero ma non le selezionano automaticamente. L'utente si aspetta che il sistema usi le categorie filtrate per la ricerca.

## Soluzione
Aggiungere un pulsante "Seleziona tutti i visibili" che auto-seleziona tutti i codici ATECO che passano i filtri ranking attivi. Inoltre, mostrare i badge delle province nel pannello Import per conferma visiva.

## Modifiche tecniche

### 1. `AtecoGrid.tsx` - Esporre i codici visibili + pulsante "Seleziona filtrati"
- Aggiungere un pulsante sopra l'albero ATECO "Seleziona tutti i filtrati" che appare solo quando ci sono filtri ranking attivi e nessun codice selezionato
- Questo pulsante raccoglie tutti i codici gruppo (livello 3) che passano `passesRankingFilter` e li seleziona tutti in un colpo
- Esporre anche un contatore "X categorie visibili" per dare feedback

### 2. `ProspectImporter.tsx` - Permettere ricerca anche senza ATECO espliciti
- Modificare la condizione `disabled` del pulsante "Cerca Aziende": permettere la ricerca anche quando ci sono solo filtri geografici (province) senza codici ATECO
- Quando `atecoCodes` e' vuoto ma ci sono province/regioni, la ricerca procede senza filtro ATECO (cerca tutte le aziende nella zona)
- Aggiungere badge per le province selezionate nella sezione filtri attivi (accanto a regioni e fatturato)

### 3. `ProspectCenter.tsx` - Passare callback per selezione massiva
- Aggiungere una funzione `selectMultiple(codes: string[])` da passare all'AtecoGrid
- Questa funzione aggiunge tutti i codici passati allo stato `selectedAteco`

### File da modificare
- `src/components/prospects/AtecoGrid.tsx` -- pulsante "Seleziona filtrati" + contatore
- `src/components/prospects/ProspectImporter.tsx` -- badge province, ricerca senza ATECO obbligatorio
- `src/pages/ProspectCenter.tsx` -- callback selezione massiva

