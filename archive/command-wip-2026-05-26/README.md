# Command WIP Archive (2026-05-26)

File spostati fuori da `src/` per liberare `tsconfig.app.json` da `exclude[]`.
**Nessuno era importato.** Erano feature in pausa con errori type non risolti.

Se servono in futuro: copia il file in `src/v2/ui/pages/command/...` e tipizzalo
secondo gli standard correnti (no `any`, strict null checks).

File:
- `command-hooks/useCommandSubmit.ts` (435 LOC)
- `command-hooks/useScenarioFlow.ts` (59 LOC)
- `command-hooks/useToolExecution.ts` (304 LOC)
- `command-components/CommandOutput.tsx` (229 LOC)
- `command-lib/safeQueryExecutor.ts` (187 LOC)
- `prompt-lab-hooks/useGlobalPromptImprover.ts` (513 LOC)
- `tests/token-logger.test.ts` (341 LOC)
