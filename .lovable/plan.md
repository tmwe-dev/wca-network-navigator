
# Fix Cockpit Height in Outreach Container

## Problema
Il Cockpit usa `h-[calc(100vh-3.5rem)]` che sottrae solo la header principale (56px), ma quando è dentro Outreach c'è anche la tab bar superiore (~40px). Totale non sottratto: ~96px. I bottoni di azione email/conferma nel pannello AIDraftStudio finiscono fuori schermo.

## Soluzione

### `src/pages/Cockpit.tsx`
- Cambiare `h-[calc(100vh-3.5rem)]` → `h-full` per adattarsi al container parent invece di calcolare altezze assolute. Il parent in Outreach già gestisce `flex-1 min-h-0 overflow-hidden`.

Questo fa sì che il Cockpit rispetti lo spazio disponibile nel container Outreach, rendendo visibili i bottoni di invio/copia/rigenera nel footer dell'AIDraftStudio.
