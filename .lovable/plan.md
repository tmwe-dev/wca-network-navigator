

# Fix Scroll Containment: liste interne scrollano, pagine mai

## Problema

Diverse pagine permettono alla pagina intera di scrollare invece di contenere le liste in scroll interni. Le pagine problematiche:

1. **SuperHome3D** — `overflow-y-auto` sul contenitore principale (riga 84): la pagina intera scrolla
2. **Sorting** — `h-[calc(100vh-4rem)]` senza `overflow-hidden` sul contenitore principale; il pannello sinistro (`w-[40%]`) non ha `overflow-hidden`
3. **CampagneTab** — `h-full p-4 gap-4` ma la griglia stats + tabs sopra la ScrollArea possono spingere il contenuto fuori viewport; manca `overflow-hidden` sul padre
4. **AttivitaTab** — stesso problema di CampagneTab: stats + tabs + ScrollArea senza `overflow-hidden`
5. **Import** (396 righe) — probabilmente ha `overflow-auto` o nessun contenimento
6. **Settings** — `overflow-auto` sul contenitore tabs (riga 57) — corretto perche e un form, ma va verificato

## Pagine gia corrette
- **Dashboard** — `h-full overflow-hidden` + `flex-1 min-h-0 overflow-hidden`
- **Outreach** — `h-full overflow-hidden` + `flex-1 min-h-0 overflow-hidden`
- **CRM** — `h-full overflow-hidden`
- **Operations** — layout a colonne con `overflow-hidden`
- **Cockpit** — `h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden`
- **Workspace** — `flex-1 min-h-0` con ResizablePanel
- **Agents** — `h-[calc(100vh-3.5rem)] overflow-hidden`

## Modifiche

### 1. `src/pages/SuperHome3D.tsx` (riga 84)
- Cambiare `overflow-y-auto` in `overflow-hidden` sul div principale
- Wrappare il contenuto in `ScrollArea` con `className="h-full"` per scroll interno

### 2. `src/pages/Sorting.tsx` (riga 60)
- Cambiare `h-[calc(100vh-4rem)]` in `h-full overflow-hidden`
- Aggiungere `overflow-hidden` al div flex dei pannelli (riga 61 gia ha `overflow-hidden`)
- Pannello sinistro: aggiungere `overflow-hidden` al div `w-[40%]`
- Pannello destro: aggiungere `overflow-hidden` al div `flex-1`

### 3. `src/components/outreach/CampagneTab.tsx` (riga 59)
- Aggiungere `overflow-hidden` al div padre: `flex flex-col h-full p-4 gap-4 overflow-hidden`
- Stats grid e Tabs restano `shrink-0`
- ScrollArea prende `flex-1 min-h-0`

### 4. `src/components/outreach/AttivitaTab.tsx` (riga 52)
- Stessa fix: `overflow-hidden` sul padre, `shrink-0` su stats e tabs, `min-h-0` su ScrollArea

### 5. `src/pages/Import.tsx`
- Verificare e aggiungere `h-full overflow-hidden` al contenitore root, con scroll interno dove servono le liste

### 6. `src/pages/Settings.tsx` (riga 57)
- OK cosi com'e: `overflow-auto` e corretto per un form di impostazioni

## Riepilogo file

| File | Azione |
|------|--------|
| `src/pages/SuperHome3D.tsx` | ScrollArea interna invece di overflow-y-auto |
| `src/pages/Sorting.tsx` | h-full overflow-hidden + overflow sui pannelli |
| `src/components/outreach/CampagneTab.tsx` | overflow-hidden + min-h-0 su ScrollArea |
| `src/components/outreach/AttivitaTab.tsx` | overflow-hidden + min-h-0 su ScrollArea |
| `src/pages/Import.tsx` | Contenimento scroll (da verificare struttura) |

