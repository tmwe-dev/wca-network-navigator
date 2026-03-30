

# Due Pannelli Globali: Mission Context + Filtri

## Concetto

Due drawer laterali sempre disponibili da **AppLayout**, accessibili da qualsiasi pagina:

1. **Pannello Destro — "Mission Context"** (Goal, Proposta, Documenti, Link, Preset)
   - Aperto con un bottone fisso nell'header (icona Target)
   - Contiene il GoalBar esistente, riutilizzando `useWorkspaceDocuments`, `useWorkspacePresets` e gli hook correlati
   - Il contesto impostato qui viene usato automaticamente da tutte le funzioni di generazione email (Email Composer, Cockpit draft, Workspace, Campagne)
   - Stato condiviso tramite React Context (`MissionContext`) in modo che ogni componente email possa leggere goal/proposta/documenti/link senza doverli passare come props

2. **Pannello Sinistro — "Filtri & Ordinamento"**
   - Aperto con un bottone fisso nell'header (icona Filter)
   - Contiene filtri contestuali alla pagina attiva (Network: qualita/paese, Cockpit: origine/priorita/canale, CRM: gruppo/origine)
   - Ordinamento (Nome, Paese, Priorita, Azienda)
   - Bottone "Applica" per confermare
   - Emette i filtri tramite un Context (`GlobalFilters`) che le pagine leggono

## Modifiche ai file

### Nuovi file
1. **`src/contexts/MissionContext.tsx`** (~60 righe) — Context + Provider con stato goal, proposta, documenti, link. Wrappa `useWorkspaceDocuments` e `useWorkspacePresets`. Espone `useMission()`.
2. **`src/components/global/MissionDrawer.tsx`** (~80 righe) — Sheet da destra che renderizza il GoalBar esistente, collegato a MissionContext.
3. **`src/contexts/GlobalFiltersContext.tsx`** (~50 righe) — Context per filtri/ordinamento attivi, con setter e route-awareness.
4. **`src/components/global/FiltersDrawer.tsx`** (~100 righe) — Sheet da sinistra con filtri contestuali per route, ordinamento, bottone "Applica".

### File modificati
5. **`src/components/layout/AppLayout.tsx`** — Aggiungere MissionProvider e GlobalFiltersProvider come wrapper. Aggiungere due bottoni nell'header (Target per Mission, Filter per Filtri). Renderizzare MissionDrawer e FiltersDrawer.
6. **`src/pages/Cockpit.tsx`** — Rimuovere filtri inline, leggere da `useGlobalFilters()`. Rimuovere la gestione locale di `activeFilters`.
7. **`src/pages/Operations.tsx`** — Rimuovere filtri/stat pills inline, leggere da `useGlobalFilters()`.
8. **`src/components/cockpit/TopCommandBar.tsx`** — Rimuovere searchQuery inline (spostato nel FiltersDrawer).
9. **`src/pages/Workspace.tsx`** / **`src/pages/EmailComposer.tsx`** — Leggere goal/proposta/documenti/link da `useMission()` invece di stato locale.

## Flusso utente

- L'utente apre qualsiasi pagina. Nell'header vede due icone: **Target** (destra) e **Filtro** (sinistra)
- Click su Target: si apre il drawer destro con Goal, Proposta, Documenti, Link e Preset
- Click su Filtro: si apre il drawer sinistro con filtri e ordinamento contestuali alla pagina attiva
- Le maschere restano pulite, senza barre filtri o GoalBar incorporati
- Quando genera un'email (da qualsiasi punto), il sistema usa automaticamente il contesto Mission

## Dettaglio tecnico

```text
AppLayout
├── MissionProvider (Context)
│   ├── GlobalFiltersProvider (Context, route-aware)
│   │   ├── Header [+Target btn] [+Filter btn]
│   │   ├── <Outlet /> (pagine pulite, senza filtri inline)
│   │   ├── MissionDrawer (Sheet side="right")
│   │   └── FiltersDrawer (Sheet side="left")
```

I filtri nel drawer sinistro cambiano dinamicamente in base alla route (`/outreach` mostra origine/priorita/canale, `/network` mostra qualita/paese, `/crm` mostra gruppo/tipo). Il bottone "Applica" chiude il drawer e aggiorna il context.

