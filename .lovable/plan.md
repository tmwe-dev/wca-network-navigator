

# Redesign Pannelli Globali + Edge Hover + Pulizia Filtri Inline

## 3 problemi da risolvere

1. **Mission Drawer e Filters Drawer sono brutti** — design minimale, nessun polish
2. **Nessun trigger edge-hover** — l'utente deve cliccare icone nell'header mischiato ad altre icone
3. **Filtri inline ancora presenti** — Contacts (`ContactFiltersBar` con 392 righe), Cockpit (`TopCommandBar` con search/origin), Workspace (source tabs + search inline)

---

## 1. Edge Hover Trigger (AppLayout.tsx)

Aggiungere due zone invisibili (4px di larghezza) sui bordi sinistro e destro dello schermo. Al `mouseenter` (con 150ms debounce) si apre il drawer corrispondente. Questo si aggiunge ai bottoni header esistenti.

```text
┌─[4px]──────────────────────────────────[4px]─┐
│ ↕    Filters Drawer        Main Content       Mission Drawer    ↕ │
│ hover                                                      hover │
└──────────────────────────────────────────────┘
```

## 2. Redesign MissionDrawer (destra)

Riscrivere `MissionDrawer.tsx` senza dipendere da `GoalBar` (componente pesante 227 righe con logica preset). Costruire UI dedicata e pulita:

- Header con gradient sottile e icona Target
- **4 sezioni collassabili** con accordion:
  - **Obiettivo** — textarea compatta
  - **Proposta Base** — textarea compatta
  - **Documenti** — lista file con upload drag-drop
  - **Link di Riferimento** — lista link con input add
- **Preset selector** in fondo (select + save/delete)
- Tutto collegato a `useMission()` come ora

## 3. Redesign FiltersDrawer (sinistra)

Riscrivere `FiltersDrawer.tsx` con design coerente e filtri route-aware piu completi:

- Header con gradient e icona SlidersHorizontal
- **Cerca** — input sempre visibile
- **Ordinamento** — chip toggle
- **Filtri contestuali per route**:
  - `/outreach`, `/crm`: Origine (WCA/Import/RA), Stato, Priorita
  - `/network`: Qualita dati (No Profilo/Email/Phone/Deep Search)
  - `/contacts`: GroupBy (Paese/Origine/Status/Data), Holding Pattern, Stato lead
- **Footer**: Reset + Applica con contatore filtri attivi

## 4. Pulizia filtri inline dalle maschere

### Contacts (`ContactListPanel.tsx`)
- Rimuovere `<ContactFiltersBar>` — spostare groupBy, holdingPattern, search, sort nel `GlobalFiltersContext`
- Aggiungere al context: `groupBy`, `holdingPattern`, `leadStatus` per la route `/contacts`
- Il componente legge da `useGlobalFilters()` invece di stato locale

### Cockpit (`Cockpit.tsx` + `TopCommandBar.tsx`)
- Rimuovere `searchQuery` e `visibleOrigins` locali dal Cockpit — leggerli da `useGlobalFilters()`
- `TopCommandBar`: rimuovere campo search inline, mantenere solo AI command input e view mode toggle
- `ContactStream`: riceve search/origins dal context

### Workspace (`Workspace.tsx`)
- Rimuovere search bar inline (riga 283-290) — il search viene dal FiltersDrawer
- Source tabs (WCA/Prospect/Contatti) restano inline perche sono specifici del workspace, non filtri generici

## 5. GlobalFiltersContext ampliato

Aggiungere al context i campi mancanti per supportare tutte le route:
- `groupBy: string` (per Contacts)
- `holdingPattern: string` (per Contacts)
- `leadStatus: string` (per Contacts)
- `origins: Set<string>` (per Cockpit — rinominare da `origin`)

## File modificati

| File | Azione |
|------|--------|
| `src/components/global/MissionDrawer.tsx` | Riscritto — UI dedicata con accordion |
| `src/components/global/FiltersDrawer.tsx` | Riscritto — filtri route-aware completi |
| `src/contexts/GlobalFiltersContext.tsx` | Ampliato con groupBy, holdingPattern, leadStatus |
| `src/components/layout/AppLayout.tsx` | Aggiungere edge-hover zones |
| `src/components/contacts/ContactListPanel.tsx` | Rimuovere ContactFiltersBar, leggere da context |
| `src/pages/Cockpit.tsx` | Rimuovere searchQuery/visibleOrigins locali |
| `src/components/cockpit/TopCommandBar.tsx` | Rimuovere search inline |
| `src/pages/Workspace.tsx` | Rimuovere search bar inline |

