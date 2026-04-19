

# Piano interventi — Sidebar Filters & Mission

Procedo in **3 fasi** seguendo le priorità dell'audit. Fase 1 sblocca l'usabilità, Fase 2 migliora UX, Fase 3 è opzionale.

## FASE 1 — Bloccanti (3 fix)

### 1.1 Bug Campaigns: filtri inline → FiltersDrawer

- **Crea** `src/components/global/filters-drawer/CampaignsFiltersSection.tsx` — replica i 4 controlli (Search, Sort name/city/contacts, Type, AI Query) usando `GlobalFiltersContext`.
- **Estendi** `GlobalFiltersContext` con stato campaigns: `campaignsSearch`, `campaignsSort {field, asc}`, `campaignsTypeFilter`, `campaignsAiQuery`.
- **Modifica** `useFiltersDrawerState.ts` → aggiungi `isCampaigns` (path `/v2/campaigns` o `/campaigns`) + `sectionTitle` "Filtri Campagne".
- **Modifica** `FiltersDrawer.tsx` → renderizza `<CampaignsFiltersSection>` quando `isCampaigns`.
- **Modifica** `CompanyListFilters.tsx` → leggi i valori dal context invece che da props locali; mantieni solo il rendering minimale o rimuovi (la pagina Campaigns userà i filtri globali).

### 1.2 Collegare i 9 event listener mancanti del MissionDrawer

Aggiungo i listener nelle pagine target. Pattern: `useEffect` con `window.addEventListener` + cleanup, dispatch su pagina giusta.

| Evento | File destinazione | Handler |
|---|---|---|
| `deep-search-country` | `NetworkPage` (V2) o `CountryGridV2` | apre dialog deep search paese corrente |
| `generate-aliases` | `NetworkPage` | invoca `useAliasBatch` esistente o edge `generate-aliases` |
| `export-partners` | `NetworkPage` | trigger CSV export tramite hook esistente |
| `crm-deep-search` | `CRMPage` | apre LinkedIn/web lookup sui contatti selezionati |
| `crm-linkedin-lookup` | `CRMPage` | invoca `linkedin-enrich` edge |
| `crm-send-cockpit` | `CRMPage` | seleziona contatti → naviga a `/v2/outreach?tab=cockpit` con prefill |
| `crm-export` | `CRMPage` | export CSV |
| `enrichment-batch-start` | `Settings` (Strumenti) | invoca `enrichment-batch` edge |
| `enrichment-export` | `Settings` | export risultati enrichment |

Per ogni handler che richiede infrastruttura non esistente, lascio `toast.info("Funzione in arrivo")` esplicito invece di fingere che funzioni — niente più toast falsi positivi.

### 1.3 Mission Control nel MobileBottomNav

- **Modifica** `MobileBottomNav.tsx`: sostituisco una delle 5 voci con un bottone centrale `Target` "Mission" che dispatcha `window.dispatchEvent(new CustomEvent('open-drawer', {detail: {drawer: 'mission'}}))`. Candidato da rimuovere: `email-intelligence` (accessibile da Outreach). Layout: 2 + Mission centrale + 2.

## FASE 2 — UX (4 fix)

### 2.1 ActiveMissionsPanel sempre visibile quando ci sono missioni attive

- **Modifica** `MissionDrawer.tsx`: rimuovo il gate `isOutreach || isEmailComposer`, mostro il pannello su tutte le pagine **se** `activeMissions.length > 0`.

### 2.2 Keyboard shortcut Cmd/Ctrl+M

- **Modifica** `AuthenticatedLayout.tsx`: aggiungo `useEffect` con `keydown` listener globale → dispatch `open-drawer` mission. Cmd+Shift+F per filters drawer (bonus).

### 2.3 Tooltip/help sui 5 box configurazione

- **Modifica** `ConfigurationWidget` (o dove sono i 5 box): wrap ogni box in `<Tooltip>` shadcn con descrizione breve di cosa metterci.

### 2.4 Sottotitolo drawer più informativo

- **Modifica** `MissionDrawer.tsx`: porta il sottotitolo da `text-[11px]` a `text-xs` con descrizione contestuale ("Configura goal, allega documenti e seleziona destinatari per la missione").

## FASE 3 — Skip per ora

Onboarding tour, RecipientsSection ovunque, filtri CRM Pipeline/Duplicati: lascio fuori dallo scope, da valutare dopo che le Fasi 1+2 sono in produzione.

## File toccati

**Creati (1)**
- `src/components/global/filters-drawer/CampaignsFiltersSection.tsx`

**Modificati (~10)**
- `src/contexts/GlobalFiltersContext.tsx` (+ reducer types)
- `src/components/global/filters-drawer/useFiltersDrawerState.ts`
- `src/components/global/filters-drawer/FiltersDrawer.tsx`
- `src/components/campaigns/CompanyListFilters.tsx`
- `src/pages/Campaigns.tsx` (rimuove props filtro locali)
- `src/components/MissionDrawer.tsx` (o equivalente) — gate ActiveMissions + sottotitolo
- `src/v2/ui/pages/NetworkPage.tsx` + listener events
- `src/v2/ui/pages/CRMPage.tsx` + listener events
- `src/pages/Settings.tsx` + 2 listener
- `src/components/mobile/MobileBottomNav.tsx`
- `src/components/AuthenticatedLayout.tsx` (keyboard shortcuts)
- `ConfigurationWidget` (tooltip)

## Note

- Nessuna migration DB necessaria.
- Nessuna nuova edge function.
- I `toast.info("In arrivo")` per handler senza infrastruttura sono **intenzionali**: meglio onestà che falsi successi. L'utente saprà esattamente cosa funziona davvero.
- Procedo end-to-end senza ulteriori conferme intermedie come da preferenza utente.

