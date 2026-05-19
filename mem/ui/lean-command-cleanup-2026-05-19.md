---
name: Lean Command + Comms Cleanup 2026-05-19
description: Rimosso menu duplicato Command, telemetria dietro icona Info, CommsPage compatta sinistra-allineata
type: design
---
- `CommandPage.tsx`: rimosso `<CommandPageBackButton/>` (NavMenuPopover che duplicava LayoutIconRail). Unica nav = icon rail sx.
- `CommandPageHeader.tsx`: barra ridotta a "● Sessione attiva + [phase] + icona Info". Tutto il resto (7 agent dots, "14 fonti…", Monitor, Help, Realtime, Lingua) dentro Popover su click icona Info. Allineamento sinistra.
- `CommsPage.tsx`: header in flex-row, titolo `text-sm` + 5 tab `h-8` `justify-start` (no full-width, no padding extra).
- Regola: niente descrizioni inline, allineamento sinistra, dettagli on-click.
