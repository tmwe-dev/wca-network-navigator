---
name: Macro-Area Menu 2026-06
description: Menu principale V2 raggruppato in 7 macro-aree (SSOT macroAreaGroups in navConfig); NavMenuPopover le rende con header
type: feature
---

Fase B Ristrutturazione UX 2026-06.

- SSOT: `MACRO_AREAS` + `macroAreaGroups` in `src/v2/ui/templates/navConfig.tsx`.
- 7 aree (ordine): Comando, Esplora, Pipeline, Comunica, Cervello, Lab, Config.
- Ogni voce del menu appartiene a UNA sola area (mapping per path da FULL_NAV_ITEMS).
- `NavMenuPopover` rende il menu principale raggruppato per macro-area (header uppercase) usando `macroAreaGroups` (FULL list, non filtrata da LEAN_MODE) → niente flat list, l'utente non si perde.
- Pagine dev/orfane restano nella sezione "Development" (SECONDARY_NAV).
- Aggiungere una voce al menu = aggiungere il path alla macro-area giusta in MACRO_AREAS.
