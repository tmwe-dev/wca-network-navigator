## Obiettivo

Rendere comoda la chiusura della sidebar contestuale dei filtri (`ContextFiltersRail`) dopo che l'utente ha impostato i filtri, eliminando l'unico metodo attuale (X in alto).

## Comportamento finale

Tre modi per chiudere la sidebar dei filtri, tutti attivi insieme:

1. **Click fuori (overlay invisibile)** — un click in qualsiasi punto del contenuto principale chiude la sidebar. Nessun overlay scuro: la pagina resta visibile e cliccabile sotto, ma il primo click "spende" la chiusura della sidebar.
2. **Linguetta sempre visibile come toggle** — la stessa linguetta verticale "Filtri" che oggi appare solo a sidebar chiusa resta visibile anche a sidebar aperta, attaccata al bordo destro della sidebar. Click su di essa = chiude. Diventa un vero toggle.
3. **Auto-close su "Applica filtri"** — i filtri non si applicano più al volo: bottone esplicito "Applica filtri" in fondo alla sidebar che applica e chiude. In alto un secondario "Reset" per azzerare i filtri della sezione corrente.

La X attuale in alto resta come quarta opzione (utenti che già la usano).

## Modifiche

### `src/v2/ui/templates/ContextFiltersRail.tsx`
- Aggiungere bottone-linguetta sempre visibile sul bordo destro della sidebar (sticky), sia a stato aperto sia a stato chiuso, che fa toggle di `open`.
- Aggiungere listener globale per il click-outside: se `open === true` e il click avviene fuori dall'`<aside>` e fuori dalla linguetta → chiude. Nessun overlay scuro renderizzato (non blocca interazione con la pagina).
- Footer fisso in fondo alla sidebar con due bottoni:
  - **Reset**: azzera i filtri della sezione attiva (CRM/Network/BCA).
  - **Applica filtri** (primario): commit dei filtri pending → store globale + `setOpen(false)`.

### Filtri "pending vs applied"
Oggi le sezioni filtri scrivono direttamente nello store globale (`useReducer` filters, vedi memoria *Global Filters*). Per supportare "Applica con bottone" serve uno stato locale temporaneo:
- Introdurre nel rail un buffer `pendingFilters` inizializzato dallo stato globale all'apertura.
- I componenti `CRMFiltersSection`, `NetworkFiltersSection`, `BCAFiltersSection` ricevono `value` + `onChange` puntati al buffer locale invece dello store globale.
- "Applica" → dispatch al reducer globale. "Reset" → svuota buffer + dispatch reset. Chiusura senza Applica → buffer scartato (nessuna modifica).
- Badge "modifiche non applicate" sul bottone Applica quando il buffer differisce dallo stato globale.

### Comportamento ESC (bonus gratis)
Aggiungere listener `keydown` ESC → chiude la sidebar (stesso handler del click-outside).

## File toccati

- `src/v2/ui/templates/ContextFiltersRail.tsx` — linguetta toggle, click-outside, ESC, footer Applica/Reset, gestione buffer pending.
- `src/v2/ui/templates/filters/CRMFiltersSection.tsx`, `NetworkFiltersSection.tsx`, `BCAFiltersSection.tsx` — accettare props `value`/`onChange` per lavorare sul buffer invece dello store globale (verifico esattamente le tre sezioni in fase implementativa).

## Cosa NON cambia

- Nessuna modifica a navigazione principale (`LayoutSidebarNav`), Co-Pilot, o store filtri globale.
- Nessuna modifica a logica di business / DAL.
- Layout generale `AuthenticatedLayout` invariato.
