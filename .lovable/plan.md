
## Piano: estensione Command con interattività, real-time e copertura completa

Eseguo le 3 fasi end-to-end, preservando rigorosamente l'estetica esistente (float-panel, gradient, animazioni framer-motion, badge LIVE/DEMO, font mono/extralight).

### FASE 1 — Canvas interattivi
1. Estendere `tools/types.ts`: aggiungere `selectable?: boolean` e `bulkActions?: { id, label, prompt }[]` ai result `table` e `card-grid`.
2. Aggiungere `selectedRows: Record<string, Set<string>>` in `useCommandState.ts` con helper toggle/clear.
3. `TableCanvas.tsx`: aggiungere colonna checkbox (stile minimal mono) + barra azioni bulk in alto con stessa estetica float-panel-subtle. Rimuovere KPI hardcoded da `src/components/workspace/CanvasViews.tsx`.
4. `CardGridCanvas.tsx`: aggiungere checkbox angolo card con animazione scale-in + bulk bar.
5. Quando l'utente clicca una bulk-action → costruisce un prompt arricchito con gli ID selezionati e lo invia a `useCommandSubmit` (riusa il loop AI esistente).

### FASE 2 — Real-time monitoring
1. Nuovo hook `useCommandRealtime.ts`: subscription Supabase su `download_jobs`, `outreach_queue`, `agent_action_log`, `mission_runs`, `campaign_jobs`. Filtrato per user_id, cleanup su unmount (pattern async-hook-resilience).
2. Nuovo componente `LiveActivityRail.tsx`: striscia laterale destra del canvas con job in corso (progress bar gradient-primary), ultime 8 azioni AI, palpitio success/warning. Stessa estetica float-panel.
3. Auto-refresh canvas: quando un job collegato al `liveResult` completa via realtime, ri-esegue silenziosamente la query del tool e aggiorna il canvas con animazione fade-in.

### FASE 3 — 10 nuovi tool (copertura ~70%)
Aggiunti in `tools/registry.ts` con definizioni in `aiBridge.ts`:
- **Inbox**: `inboxList`, `replyToEmail` (canvas card-grid + composer)
- **Mission**: `createMission`, `missionStatus` (canvas flow + timeline)
- **Agenda**: `agendaToday`, `addAgendaActivity` (canvas timeline)
- **Governance**: `approvalsQueue`, `approveAction` (canvas table selectable + bulk)
- **System**: `runDiagnostics`, `kbSupervisorScan` (canvas report)

Ogni tool: query DAL reale (no mock), Zod schema su edge dove serve, riuso canvas esistenti.

### Garanzie estetiche
- Zero modifiche a token colore, gradient, font, ease curves.
- Nuovi elementi (checkbox, rail, bulk bar) ereditano `float-panel`, `text-gradient-primary`, animazioni framer (`ease = [0.2, 0.8, 0.2, 1]`).
- Nessun componente shadcn introdotto se non già presente (Checkbox da `@/components/ui/checkbox` già esistente).

### File principali toccati
- `src/v2/ui/pages/command/tools/types.ts`
- `src/v2/ui/pages/command/canvas/TableCanvas.tsx`
- `src/v2/ui/pages/command/canvas/CardGridCanvas.tsx`
- `src/v2/ui/pages/command/canvas/LiveActivityRail.tsx` (nuovo)
- `src/v2/ui/pages/command/hooks/useCommandState.ts`
- `src/v2/ui/pages/command/hooks/useCommandRealtime.ts` (nuovo)
- `src/v2/ui/pages/command/hooks/useCommandSubmit.ts`
- `src/v2/ui/pages/command/aiBridge.ts`
- `src/v2/ui/pages/command/tools/registry.ts` + 10 nuovi file tool
- `src/components/workspace/CanvasViews.tsx` (fix KPI hardcoded)
- `src/v2/ui/pages/command/components/CommandCanvas.tsx` (montaggio rail)

Nessun mock reintrodotto. Tutto live dal DB.
