---
name: Drawer Overlay Pattern
description: Tutte le sidebar/drawer/pannelli laterali devono aprirsi in OVERLAY (fixed + backdrop scuro) sopra il contenuto, mai come flex item che spinge il layout
type: design
---
**Regola globale UI**: ogni drawer/sidebar a scomparsa (filtri, mission, command, ecc.)
deve aprirsi SOPRA il contenuto della pagina, NON spostarlo.

Pattern obbligatorio:
- Pannello: `fixed`, slide-in con `translate-x`, z-index alto (≥60).
- Backdrop: `fixed inset-0 bg-black/40 backdrop-blur-[1px]` con `z-[55]`, click-to-close.
- Linguetta/trigger: `fixed`, sempre visibile, z-index sopra il backdrop.
- Mai usare `shrink-0 w-80` come flex item nel layout principale.

Componenti già conformi: `Sheet` di shadcn (FiltersDrawer, MissionDrawer, ecc.).
Componente fixato 2026-05-02: `ContextFiltersRail` (era flex item, ora overlay).

Eccezioni ammesse: pannelli STRUTTURALI di pagina (es. AtlasSidebar, KnowledgeBase
sidebar, PromptHistoryTab list) che sono colonne di navigazione fisse, non drawer.
