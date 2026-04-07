

# Linguette che scompaiono + Sidebar ridimensionabili + Ordinamento sotto ricerca

## 1. Linguette scompaiono quando la sidebar è aperta

In `AppLayout.tsx` le due `<button>` (righe 108-135) attualmente si spostano con `left: filtersOpen ? ... : 0`. La modifica:

- Quando `filtersOpen === true` → la linguetta sinistra diventa `opacity-0 pointer-events-none` (scompare)
- Quando `missionOpen === true` → la linguetta destra diventa `opacity-0 pointer-events-none` (scompare)
- Quando la sidebar si chiude → la linguetta riappare con transizione fade

Basta aggiungere le classi condizionali e rimuovere il calcolo `left`/`right` che le fa scorrere. La linguetta resta fissa al bordo dello schermo e semplicemente appare/scompare.

## 2. Sidebar ridimensionabili (drag per allargare)

Aggiungere un handle di resize al bordo interno di entrambe le sidebar:

- **FiltersDrawer** (sinistra): un div di 4px sul bordo destro del `SheetContent`, con `cursor: col-resize` e logica `onMouseDown` → `onMouseMove` per aggiornare la larghezza tramite state locale (`drawerWidth`). Min 320px, max 80vw.
- **MissionDrawer** (destra): stesso pattern sul bordo sinistro.

La larghezza viene applicata come `style={{ width: drawerWidth }}` al posto delle classi fisse `w-[90vw] sm:w-[400px]`.

## 3. Ordinamento sotto la barra ricerca nel navigatore CRM

Nel `CRMContactNavigator` dentro `FiltersDrawer.tsx`, subito dopo l'input di ricerca e prima dell'elenco gruppi, inserire una riga compatta con i bottoni di ordinamento:

```text
[🔍 Cerca contatto...]
[Nome ↕] [Azienda ↕] [Città ↕] [Paese ↕]
─────────────────────────────
🇮🇹 Italy (234)
  ...
```

I bottoni toggle ASC/DESC agiscono sull'ordinamento dei contatti all'interno dei gruppi espansi.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/layout/AppLayout.tsx` | Linguette: aggiungere `opacity-0 pointer-events-none` condizionale quando la rispettiva sidebar è aperta; rimuovere il calcolo `left`/`right` dinamico |
| `src/components/global/FiltersDrawer.tsx` | Aggiungere handle di resize sul bordo destro + state `width`; aggiungere barra ordinamento sotto la ricerca nel navigatore |
| `src/components/global/MissionDrawer.tsx` | Aggiungere handle di resize sul bordo sinistro + state `width` |

Nessuna migrazione DB.

