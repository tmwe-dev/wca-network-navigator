

# Spostare la Barra Blu nel Top Header

## Problema

La pagina Network ha una barra interna (righe 141-185 di `Operations.tsx`) con: globo rotante, titolo "Network", toggle Partner/Business Cards, stats partner, e azioni. Questa barra occupa spazio verticale quando il header globale (`AppLayout.tsx`) ha già spazio sufficiente.

## Piano

### 1. Usare un Portal/Slot per iniettare contenuto nell'header

L'header globale ha già un `div#campaign-header-controls` (riga 146) pensato come slot per contenuti delle pagine figlie. Lo sfruttiamo:

**`src/pages/Operations.tsx`**:
- Rimuovere la barra interna (righe 141-186) come elemento fisso
- Usare `createPortal` per renderizzare il contenuto (globo, toggle Partner/BCA, stats, azioni) dentro `#campaign-header-controls` nell'header globale
- Il contenuto sarà compatto, inline, adatto all'altezza dell'header (h-11/h-12)

### 2. Adattare lo stile

- Il globo rotante, il toggle Partner/Business Cards e le stats diventano elementi inline compatti (altezza ~28px) coerenti con l'header
- Rimuovere bordi e background della barra — si fondono nel background dell'header
- Il padding verticale del main content guadagna ~52px di spazio utile

## File modificati

| File | Modifica |
|------|----------|
| `src/pages/Operations.tsx` | Barra interna → `createPortal` in `#campaign-header-controls`, stile compatto inline |

## Risultato

Il contenuto della barra blu (globo, toggle, stats) appare direttamente nel top header globale. Nessuna barra separata sotto. Più spazio per le 3 colonne.

