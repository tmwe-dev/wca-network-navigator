---
name: Persistent UI Layout Rule
description: Tutti i pannelli ridimensionabili devono persistere le dimensioni utente in localStorage via PersistentResizablePanelGroup
type: preference
---
REGOLA DI SISTEMA: ogni layout split/resizable in cui l'utente può trascinare una maniglia (orizzontale o verticale) DEVE memorizzare le proporzioni scelte e ripristinarle alla prossima apertura.

**Come applicare**:
- Usa `PersistentResizablePanelGroup` (`src/v2/ui/atoms/PersistentResizablePanelGroup.tsx`) al posto di `ResizablePanelGroup` ogni volta che ci sono `ResizableHandle` trascinabili.
- Passa una prop `storageId` stabile in formato `<feature>:<panel-purpose>` (kebab-case). Es: `prompt-lab:main-vs-chat`, `prompt-lab:blocks-vs-editor`, `golden-layout:list-vs-detail`, `kb-supervisor:chat-vs-canvas`, `email-forge:oracle-vs-output`.
- NON cambiare `storageId` dopo il rilascio: rompe il ripristino per gli utenti esistenti.
- Sotto il cofano usa `autoSaveId` di `react-resizable-panels` con prefisso `ui:resizable:`.

**Vietato**: usare `ResizablePanelGroup` nudo senza persistenza in pagine utente. Ammesso solo per split temporanei interni a un dialog/sheet che ha un solo uso transitorio.
