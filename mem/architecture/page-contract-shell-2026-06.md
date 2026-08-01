---
name: Page Contract Shell
description: Guscio uniforme V2 — pageContract.ts guida filtri (sx) e workflow (dx); StandardPageFrame dà header+AI uniforme
type: architecture
---
Ristrutturazione UX 2026-06. Single source of truth per la shell di ogni maschera:
- `src/v2/navigation/pageContract.ts`: `FILTER_RULES` (path→FilterKey, ordinate) + `resolveFilterRule()` per la sidebar SINISTRA (filtri); `pageHasWorkflow(pathname)` per mostrare/nascondere il rail DESTRO (workflow).
- `ContextFiltersRail` legge il contratto via `resolveFilterRule`; mappa FilterKey→componente in `FILTER_CONTENT`.
- `AuthenticatedLayout` nasconde la linguetta Mission (destra) quando `!pageHasWorkflow` → niente "Mission Control" generico fuori contesto.
- `src/v2/ui/templates/StandardPageFrame.tsx`: guscio presentazionale (header in-mask, breadcrumb, pulsante ✦ AI sempre presente via evento `copilot-open`, tabs `variant="pill"`). NON monta i rail (gestiti globalmente) per evitare doppioni.
- FloatingCoPilot ascolta `copilot-open` per espandersi.
Regola: SINISTRA = solo filtri, DESTRA = solo workflow, AI sempre in cima alla maschera.

Fase C (2026-06): adozione StandardPageFrame su pagine speciali (CockpitPage, CommsPage) preservandone il comportamento (Cockpit usa `contentOverflow="contain"` + wrapper flex-col interno; Comms usa `tabs` SectionTabs pill route-based su `/v2/comms/:tab`). CommandPalette (Cmd+K) ora deriva la navigazione SOLO da `macroAreaGroups` (navConfig) = stessa SSOT del NavMenuPopover; rimossa la vecchia lista hardcoded NAV_ITEMS/QUICK_ACTIONS.
